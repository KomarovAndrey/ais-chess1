import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildGameRatingResult } from "@/lib/games/ratingResult";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** GET: post-game rating deltas for both sides (rated games only). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { gameId } = await params;
  if (!UUID_REGEX.test(gameId)) {
    return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  }

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, status, rated, time_control_seconds, ratings_applied")
    .eq("id", gameId)
    .maybeSingle();

  if (gameError || !game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (game.status !== "finished" || !game.rated) {
    return NextResponse.json({
      rated: false,
      category: null,
      white: null,
      black: null,
    });
  }

  const { data: players } = await supabase
    .from("game_players")
    .select("side, player_id")
    .eq("game_id", gameId);

  const white = players?.find((p) => p.side === "white");
  const black = players?.find((p) => p.side === "black");
  const userIds = [white?.player_id, black?.player_id].filter(Boolean) as string[];

  if (userIds.length === 0) {
    return NextResponse.json({
      rated: true,
      category: null,
      white: null,
      black: null,
    });
  }

  const { data: historyRows } = await supabase
    .from("rating_history")
    .select("user_id, game_id, category, rating, created_at")
    .in("user_id", userIds)
    .order("created_at", { ascending: true });

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, games_played_bullet, games_played_blitz, games_played_rapid"
    )
    .in("id", userIds);

  const profilesById = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  );

  const result = buildGameRatingResult(
    Boolean(game.rated),
    gameId,
    game.time_control_seconds,
    white?.player_id ?? null,
    black?.player_id ?? null,
    (historyRows ?? []) as Array<{
      user_id: string;
      game_id: string | null;
      category: "bullet" | "blitz" | "rapid";
      rating: number;
      created_at: string;
    }>,
    profilesById
  );

  return NextResponse.json(result);
}
