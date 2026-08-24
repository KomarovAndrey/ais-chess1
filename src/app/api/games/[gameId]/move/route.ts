import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";
import { getSupabaseOptionalUser } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { moveBodySchema } from "@/lib/validations/games";
import {
  applyGameRatings,
  applyIncrement,
  computeClocksAfterElapsed,
  computeStatusAndWinner,
  findPlayer,
  finishActiveGame,
  getGameWriteClient,
  SERVICE_ROLE_MISSING,
  requireAuthForRated,
  type GamePlayerRow,
} from "@/lib/games/integrity";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const auth = await getSupabaseOptionalUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;
  const writeClient = getGameWriteClient(supabase);
  if (!writeClient) {
    return NextResponse.json(SERVICE_ROLE_MISSING, { status: 503 });
  }

  try {
    const body = await req.json();
    const bodyPlayerId = (body as { playerId?: string }).playerId;
    const playerId = user?.id ?? bodyPlayerId;
    if (!playerId || (user === null && !bodyPlayerId)) {
      return NextResponse.json(
        { error: "Для игры без входа укажите playerId в теле запроса." },
        { status: 400 }
      );
    }

    if (!await checkRateLimit(playerId)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { gameId } = await params;
    if (!UUID_REGEX.test(gameId)) {
      return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
    }

    const parsed = moveBodySchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const message = Object.values(first).flat().join(" ") || "Validation failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (!("uci" in parsed.data)) {
      return NextResponse.json(
        {
          error:
            "Устаревший формат хода. Используйте UCI, либо /resign, /draw, /timeout.",
        },
        { status: 400 }
      );
    }

    const uci = parsed.data.uci;

    const { data: currentGame, error: gameError } = await writeClient
      .from("games")
      .select(
        "id, status, fen, active_color, white_time_left, black_time_left, last_move_at, moves, increment_seconds, rated"
      )
      .eq("id", gameId)
      .single();

    if (gameError || !currentGame) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const ratedBlock = requireAuthForRated(currentGame.rated, user);
    if (ratedBlock) {
      return NextResponse.json({ error: ratedBlock }, { status: 401 });
    }

    if (currentGame.status !== "active") {
      return NextResponse.json(
        { error: "Game is not in progress" },
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

    const expectedSide: "white" | "black" =
      currentGame.active_color === "w" ? "white" : "black";
    if (playerRow.side !== expectedSide) {
      return NextResponse.json(
        { error: "It is not your turn" },
        { status: 403 }
      );
    }

    const currentFen =
      currentGame.fen === "startpos" || !currentGame.fen
        ? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        : currentGame.fen;
    const currentActive = (currentGame.active_color ?? "w") as "w" | "b";
    const currentWhite = currentGame.white_time_left ?? 0;
    const currentBlack = currentGame.black_time_left ?? 0;
    const lastMoveAt = currentGame.last_move_at ?? null;

    const { whiteTimeLeft: clockWhite, blackTimeLeft: clockBlack } =
      computeClocksAfterElapsed(currentWhite, currentBlack, lastMoveAt, currentActive);

    if (clockWhite <= 0 || clockBlack <= 0) {
      const winner = clockWhite <= 0 ? "black" : "white";
      const { game } = await finishActiveGame(writeClient, gameId, winner, {
        whiteTimeLeft: clockWhite,
        blackTimeLeft: clockBlack,
        fen: currentGame.fen,
        activeColor: currentActive,
        clearDrawOffer: true,
      });
      return NextResponse.json({ game }, { status: 200 });
    }

    let chess: Chess;
    try {
      chess = new Chess(currentFen);
    } catch {
      return NextResponse.json({ error: "Invalid game position" }, { status: 400 });
    }

    const move = chess.move(uci, { strict: false });
    if (!move) {
      return NextResponse.json({ error: "Недопустимый ход" }, { status: 400 });
    }

    const movedSide = currentActive;
    const inc = typeof currentGame.increment_seconds === "number"
      ? currentGame.increment_seconds
      : 0;
    const withInc = applyIncrement(clockWhite, clockBlack, movedSide, inc);
    let nextWhite = withInc.whiteTimeLeft;
    let nextBlack = withInc.blackTimeLeft;

    const newFen = chess.fen();
    const nextActive = chess.turn() as "w" | "b";
    const { status, winner } = computeStatusAndWinner(newFen, nextWhite, nextBlack);

    const currentMoves: string[] = Array.isArray(currentGame.moves)
      ? currentGame.moves
      : typeof currentGame.moves === "object" && currentGame.moves !== null
        ? (Object.values(currentGame.moves) as string[])
        : [];

    const payload = {
      fen: newFen,
      active_color: nextActive,
      white_time_left: nextWhite,
      black_time_left: nextBlack,
      last_move_at: new Date().toISOString(),
      moves: [...currentMoves, uci],
      status,
      winner: status === "finished" ? winner : null,
      draw_offer_from: null,
    };

    const { data, error } = await writeClient
      .from("games")
      .update(payload)
      .eq("id", gameId)
      .eq("status", "active")
      .select("*")
      .single();

    if (error || !data) {
      console.error("Error updating game:", error);
      return NextResponse.json(
        { error: "Failed to update game state" },
        { status: 500 }
      );
    }

    if (data.status === "finished" && data.winner) {
      await applyGameRatings(writeClient, gameId, data.winner);
    }

    return NextResponse.json({ game: data }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in POST /api/games/[gameId]/move:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
