import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

type GameRow = {
  id: string;
  status: string;
  winner: "white" | "black" | "draw" | null;
  created_at: string;
  started_at: string | null;
  time_control_seconds: number | null;
};

type GamePlayerRow = {
  game_id: string;
  side: "white" | "black";
  player_id: string;
};

type RatingHistoryRow = {
  game_id: string | null;
  category: "bullet" | "blitz" | "rapid";
  rating: number;
  created_at: string;
};

export async function GET(_req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;
  const me = user.id;

  // Найти все игры, где участвовал пользователь
  const { data: players, error: playersError } = await supabase
    .from("game_players")
    .select("game_id, side, player_id")
    .eq("player_id", me);

  if (playersError || !players || players.length === 0) {
    return NextResponse.json({ games: [] });
  }

  const gameIds = Array.from(new Set(players.map((p) => p.game_id)));

  // Получить сами партии
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("id, status, winner, created_at, started_at, time_control_seconds")
    .in("id", gameIds)
    .order("created_at", { ascending: false })
    .limit(50);

  if (gamesError || !games) {
    console.error("Profile games load error:", gamesError);
    return NextResponse.json({ games: [] });
  }

  // Все игроки этих партий
  const { data: allPlayers } = await supabase
    .from("game_players")
    .select("game_id, side, player_id")
    .in("game_id", gameIds);

  const allPlayerIds = Array.from(
    new Set((allPlayers ?? []).map((p) => p.player_id))
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", allPlayerIds);

  const usernameById = new Map(
    (profiles ?? []).map((p: { id: string; username: string | null }) => [
      p.id,
      p.username,
    ])
  );

  // История рейтинга для вычисления изменения рейтинга текущего пользователя
  const { data: ratingRows } = await supabase
    .from("rating_history")
    .select("game_id, category, rating, created_at")
    .eq("user_id", me)
    .in("game_id", gameIds as string[])
    .order("created_at", { ascending: true });

  const ratingHistory = (ratingRows ?? []) as RatingHistoryRow[];
  const prevByCategory = new Map<"bullet" | "blitz" | "rapid", number>();
  const deltaByGameId = new Map<string, number>();

  for (const row of ratingHistory) {
    if (!row.game_id) continue;
    const prev = prevByCategory.get(row.category) ?? row.rating;
    const delta = row.rating - prev;
    deltaByGameId.set(row.game_id, delta);
    prevByCategory.set(row.category, row.rating);
  }

  const sideByGame = new Map<string, "white" | "black">(
    (players as GamePlayerRow[]).map((p) => [p.game_id, p.side])
  );

  const playersByGame = new Map<
    string,
    { white: string | null; black: string | null }
  >();
  for (const p of (allPlayers ?? []) as GamePlayerRow[]) {
    let entry = playersByGame.get(p.game_id);
    if (!entry) {
      entry = { white: null, black: null };
      playersByGame.set(p.game_id, entry);
    }
    const username = usernameById.get(p.player_id) ?? null;
    if (p.side === "white") entry.white = username;
    else if (p.side === "black") entry.black = username;
  }

  const gamesOut = (games as GameRow[]).map((g) => {
    const players = playersByGame.get(g.id) ?? {
      white: null,
      black: null,
    };
    const mySide = sideByGame.get(g.id) ?? null;
    let result: string;
    if (g.status !== "finished" || !g.winner) {
      result = "—";
    } else if (g.winner === "draw") {
      result = "½–½";
    } else if (mySide && g.winner === mySide) {
      result = "Выигрыш";
    } else if (mySide && g.winner !== mySide) {
      result = "Поражение";
    } else {
      result = g.winner === "white" ? "1–0" : "0–1";
    }

    const delta = deltaByGameId.get(g.id) ?? 0;
    const minutes =
      typeof g.time_control_seconds === "number"
        ? Math.round(g.time_control_seconds / 60)
        : null;
    const mode =
      minutes && minutes > 0 ? `${minutes} мин` : `${g.time_control_seconds ?? ""} c`;

    return {
      id: g.id,
      created_at: g.created_at,
      mode,
      white_username: players.white,
      black_username: players.black,
      result,
      rating_delta: delta,
    };
  });

  return NextResponse.json({ games: gamesOut });
}

