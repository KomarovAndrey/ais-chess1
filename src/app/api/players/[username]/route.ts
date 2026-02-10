import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const { username: routeUsername } = await params;
  const username = decodeURIComponent(routeUsername).trim().toLowerCase();
  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, updated_at, rating, rating_bullet, rating_blitz, rating_rapid")
    .ilike("username", username)
    .maybeSingle();

  if (profileError) {
    console.error("Profile fetch error:", profileError);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const userId = profile.id;

  // Получить все игры пользователя
  const { data: players } = await supabase
    .from("game_players")
    .select("game_id, side, player_id")
    .eq("player_id", userId);

  const gameIds = (players ?? []).map((p) => p.game_id);
  if (gameIds.length === 0) {
    return NextResponse.json({
      profile: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name ?? profile.username,
        bio: profile.bio ?? "",
        avatar_url: (profile as any).avatar_url ?? null,
        updated_at: profile.updated_at,
        rating: (profile as any).rating_blitz ?? (profile as any).rating ?? 1500,
        rating_bullet: (profile as any).rating_bullet ?? (profile as any).rating ?? 1500,
        rating_blitz: (profile as any).rating_blitz ?? (profile as any).rating ?? 1500,
        rating_rapid: (profile as any).rating_rapid ?? (profile as any).rating ?? 1500,
      },
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
      profile: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name ?? profile.username,
        bio: profile.bio ?? "",
        avatar_url: (profile as any).avatar_url ?? null,
        updated_at: profile.updated_at,
        rating: (profile as any).rating_blitz ?? (profile as any).rating ?? 1500,
        rating_bullet: (profile as any).rating_bullet ?? (profile as any).rating ?? 1500,
        rating_blitz: (profile as any).rating_blitz ?? (profile as any).rating ?? 1500,
        rating_rapid: (profile as any).rating_rapid ?? (profile as any).rating ?? 1500,
      },
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
    profile: {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name ?? profile.username,
      bio: profile.bio ?? "",
      avatar_url: (profile as any).avatar_url ?? null,
      updated_at: profile.updated_at,
      rating: (profile as any).rating_blitz ?? (profile as any).rating ?? 1500,
      rating_bullet: (profile as any).rating_bullet ?? (profile as any).rating ?? 1500,
      rating_blitz: (profile as any).rating_blitz ?? (profile as any).rating ?? 1500,
      rating_rapid: (profile as any).rating_rapid ?? (profile as any).rating ?? 1500,
    },
    stats: {
      total: finishedGames.length,
      wins,
      losses,
      draws,
    },
    recent_games,
  });
}
