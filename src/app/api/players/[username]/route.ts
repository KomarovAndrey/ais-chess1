import { NextRequest, NextResponse } from "next/server";
import { getSupabaseOptionalUser } from "@/lib/apiAuth";
import { isStaffRole, resolveUserRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OptionalAuthResult } from "@/lib/apiAuth";

async function resolveProfileDb(auth: OptionalAuthResult) {
  if (!auth.user) return auth.supabase;

  const { data: row } = await auth.supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const role = await resolveUserRole(
    auth.supabase,
    auth.user.id,
    typeof row?.role === "string" ? row.role : null
  );

  if (isStaffRole(role)) {
    return createAdminClient() ?? auth.supabase;
  }

  return auth.supabase;
}

function serializeProfile(profile: Record<string, unknown>) {
  const gamesBlitz = Number(profile.games_played_blitz ?? 0);
  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name ?? profile.username,
    bio: profile.bio ?? "",
    updated_at: profile.updated_at,
    rating: profile.rating_blitz ?? profile.rating ?? 1500,
    rating_bullet: profile.rating_bullet ?? profile.rating ?? 1500,
    rating_blitz: profile.rating_blitz ?? profile.rating ?? 1500,
    rating_rapid: profile.rating_rapid ?? profile.rating ?? 1500,
    avatar_url: profile.avatar_url ?? null,
    games_played_bullet: profile.games_played_bullet ?? 0,
    games_played_blitz: profile.games_played_blitz ?? 0,
    games_played_rapid: profile.games_played_rapid ?? 0,
    provisional_blitz: gamesBlitz < 20,
    role: typeof profile.role === "string" ? profile.role : "student",
    class_name: typeof profile.class_name === "string" ? profile.class_name : null,
    soft_skills_league_id:
      typeof profile.soft_skills_league_id === "string" ? profile.soft_skills_league_id : null,
  };
}

const PROFILE_SELECT_CANDIDATES = [
  "id, username, display_name, bio, updated_at, rating, rating_bullet, rating_blitz, rating_rapid, games_played_bullet, games_played_blitz, games_played_rapid, role, class_name, soft_skills_league_id",
  "id, username, display_name, bio, updated_at, rating, rating_bullet, rating_blitz, rating_rapid, games_played_bullet, games_played_blitz, games_played_rapid, role",
  "id, username, display_name, bio, updated_at, rating, rating_bullet, rating_blitz, rating_rapid, games_played_bullet, games_played_blitz, games_played_rapid",
] as const;

async function fetchProfileByUsername(
  supabase: Awaited<ReturnType<typeof resolveProfileDb>>,
  username: string
) {
  let lastError: string | null = null;

  for (const select of PROFILE_SELECT_CANDIDATES) {
    const { data, error } = await supabase
      .from("profiles")
      .select(select)
      .ilike("username", username)
      .maybeSingle();

    if (!error) {
      return { profile: data as Record<string, unknown> | null, error: null as string | null };
    }

    lastError = error.message ?? "Failed to load profile";
    if (!lastError.includes("does not exist")) {
      return { profile: null, error: lastError };
    }
  }

  return { profile: null, error: lastError };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const auth = await getSupabaseOptionalUser();
  if ("response" in auth) return auth.response;
  const supabase = await resolveProfileDb(auth);

  const { username: routeUsername } = await params;
  const username = decodeURIComponent(routeUsername).trim().toLowerCase();
  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  let profile: Record<string, unknown> | null = null;
  let profileError: string | null = null;

  const loaded = await fetchProfileByUsername(supabase, username);
  profile = loaded.profile;
  profileError = loaded.error;

  if (profileError) {
    console.error("Profile fetch error:", profileError);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const userId = profile.id as string;

  // Получить все игры пользователя
  const { data: players } = await supabase
    .from("game_players")
    .select("game_id, side, player_id")
    .eq("player_id", userId);

  const gameIds = (players ?? []).map((p) => p.game_id);
  if (gameIds.length === 0) {
    return NextResponse.json({
      profile: serializeProfile(profile),
      stats: { total: 0, wins: 0, losses: 0, draws: 0 },
      recent_games: [],
    });
  }

  // Получить все игры
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("id, status, winner, created_at, started_at")
    .in("id", gameIds)
    .order("created_at", { ascending: false })
    .limit(50); // Увеличиваем лимит, чтобы потом отфильтровать

  if (gamesError) {
    console.error("Games fetch error:", gamesError);
    return NextResponse.json({
      profile: serializeProfile(profile),
      stats: { total: 0, wins: 0, losses: 0, draws: 0 },
      recent_games: [],
    });
  }

  // Получить всех игроков для этих игр
  const { data: allPlayers } = await supabase
    .from("game_players")
    .select("game_id, side, player_id")
    .in("game_id", gameIds);

  // Получить список всех зарегистрированных пользователей (их ID из profiles)
  const { data: registeredUserIds } = await supabase
    .from("profiles")
    .select("id");

  const registeredIdsSet = new Set((registeredUserIds ?? []).map((p) => p.id));

  // Фильтровать игры: оставить только те, где оба игрока зарегистрированы
  const validGames = (games ?? []).filter((game) => {
    const gamePlayers = (allPlayers ?? []).filter((p) => p.game_id === game.id);
    // Должно быть ровно 2 игрока (белые и чёрные)
    if (gamePlayers.length !== 2) return false;
    // Оба игрока должны быть зарегистрированы
    return gamePlayers.every((p) => registeredIdsSet.has(p.player_id));
  });

  // Ограничить до 20 последних
  const filteredGames = validGames.slice(0, 20);

  const playerByGame = new Map((players ?? []).map((p) => [p.game_id, p.side]));
  let wins = 0;
  let losses = 0;
  let draws = 0;
  const finishedGames = filteredGames.filter((g) => g.status === "finished");

  for (const g of finishedGames) {
    const side = playerByGame.get(g.id);
    if (!side) continue;
    if (g.winner === "draw") draws++;
    else if (g.winner === side) wins++;
    else losses++;
  }

  const recent_games = filteredGames.map((g) => {
    const side = playerByGame.get(g.id);
    return {
      id: g.id,
      side,
      winner: g.winner,
      status: g.status,
      created_at: g.created_at,
      started_at: g.started_at,
    };
  });

  return NextResponse.json({
    profile: serializeProfile(profile),
    stats: {
      total: finishedGames.length,
      wins,
      losses,
      draws,
    },
    recent_games,
  });
}
