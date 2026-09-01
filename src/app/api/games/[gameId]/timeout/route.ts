import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  findPlayer,
  finishActiveGame,
  getGameWriteClient,
  SERVICE_ROLE_MISSING,
  requireAuthForRated,
  type GamePlayerRow,
} from "@/lib/games/integrity";
import { clocksAreRunning, interpolateClocks } from "@/lib/clocks";
import { voidBroadcastGameUpdate } from "@/lib/games/broadcast";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Server-authoritative timeout claim when a player's clock reaches zero. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;
  const playerId = user.id;
  const writeClient = getGameWriteClient(supabase);
  if (!writeClient) {
    return NextResponse.json(SERVICE_ROLE_MISSING, { status: 503 });
  }

  try {
    const { gameId } = await params;
    if (!UUID_REGEX.test(gameId)) {
      return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
    }

    try {
      await req.json();
    } catch {
      /* empty body ok */
    }

    if (!await checkRateLimit(playerId)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { data: game, error: gameError } = await writeClient
      .from("games")
      .select(
        "id, status, fen, active_color, white_time_left, black_time_left, last_move_at, rated, moves"
      )
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const ratedBlock = requireAuthForRated(game.rated, user);
    if (ratedBlock) {
      return NextResponse.json({ error: ratedBlock }, { status: 401 });
    }

    if (game.status !== "active") {
      return NextResponse.json(
        { error: "Партия не активна" },
        { status: 400 }
      );
    }

    const { data: players } = await writeClient
      .from("game_players")
      .select("player_id, side")
      .eq("game_id", gameId);

    const playerRow = findPlayer(players as GamePlayerRow[] | null, playerId);
    if (!playerRow) {
      return NextResponse.json(
        { error: "You are not a player in this game" },
        { status: 403 }
      );
    }

    const activeColor = (game.active_color ?? "w") as "w" | "b";
    const moves: string[] = Array.isArray(game.moves)
      ? game.moves
      : typeof game.moves === "object" && game.moves !== null
        ? (Object.values(game.moves) as string[])
        : [];

    if (!clocksAreRunning(moves, game.last_move_at ?? null)) {
      return NextResponse.json(
        {
          error: "Часы ещё не запущены — оба игрока должны сделать первый ход",
          whiteTimeLeft: game.white_time_left ?? 0,
          blackTimeLeft: game.black_time_left ?? 0,
        },
        { status: 400 }
      );
    }

    const { whiteTimeLeft, blackTimeLeft } = interpolateClocks(
      game.white_time_left ?? 0,
      game.black_time_left ?? 0,
      game.last_move_at ?? null,
      activeColor,
      { moves }
    );

    if (whiteTimeLeft > 0 && blackTimeLeft > 0) {
      return NextResponse.json(
        { error: "Время ещё не истекло", whiteTimeLeft, blackTimeLeft },
        { status: 400 }
      );
    }

    const winner = whiteTimeLeft <= 0 ? "black" : "white";
    const { game: updated } = await finishActiveGame(writeClient, gameId, winner, {
      whiteTimeLeft,
      blackTimeLeft,
      fen: game.fen,
      activeColor,
      clearDrawOffer: true,
    });

    voidBroadcastGameUpdate(gameId, updated, "game");
    return NextResponse.json({ game: updated });
  } catch (error) {
    console.error("Unexpected error in POST /api/games/[gameId]/timeout:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
