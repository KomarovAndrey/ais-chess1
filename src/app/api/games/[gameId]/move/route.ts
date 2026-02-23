import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseOptionalUser } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { moveBodySchema } from "@/lib/validations/games";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Обновляет рейтинг по итогам партии: категория (bullet/blitz/rapid) берётся из time_control_seconds игры. */
async function updateRatings(
  supabase: SupabaseClient,
  gameId: string,
  winner: "white" | "black" | "draw"
) {
  const { error } = await supabase.rpc("update_game_ratings", {
    p_game_id: gameId,
    p_winner: winner
  });

  if (error) {
    throw new Error("Failed to update ratings");
  }
}

function computeStatusAndWinner(
  fen: string,
  activeColor: "w" | "b",
  whiteTimeLeft: number,
  blackTimeLeft: number
): { status: "waiting" | "active" | "finished"; winner: "white" | "black" | "draw" | null } {
  if (whiteTimeLeft <= 0) {
    return { status: "finished", winner: "black" };
  }
  if (blackTimeLeft <= 0) {
    return { status: "finished", winner: "white" };
  }
  if (fen === "startpos") {
    return { status: "active", winner: null };
  }
  try {
    const chess = new Chess(fen);
    if (!chess.isGameOver()) {
      return { status: "active", winner: null };
    }
    if (chess.isCheckmate()) {
      const winner = chess.turn() === "w" ? "black" : "white";
      return { status: "finished", winner };
    }
    return { status: "finished", winner: "draw" };
  } catch {
    return { status: "active", winner: null };
  }
}

/** Compute clock for the side that just moved (elapsed since last_move_at). */
function computeClocksAfterMove(
  currentWhite: number,
  currentBlack: number,
  lastMoveAt: string | null,
  sideThatJustMoved: "w" | "b"
): { whiteTimeLeft: number; blackTimeLeft: number } {
  let white = currentWhite;
  let black = currentBlack;
  const now = Date.now();
  const elapsed = lastMoveAt ? Math.max(0, now - new Date(lastMoveAt).getTime()) : 0;
  if (sideThatJustMoved === "w") {
    white = Math.max(0, currentWhite - elapsed);
  } else {
    black = Math.max(0, currentBlack - elapsed);
  }
  return { whiteTimeLeft: white, blackTimeLeft: black };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const auth = await getSupabaseOptionalUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

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

    if (!checkRateLimit(playerId)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
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

    const isUci = "uci" in parsed.data && typeof parsed.data.uci === "string";

    const { data: currentGame, error: gameError } = await supabase
      .from("games")
      .select("id, status, fen, active_color, white_time_left, black_time_left, last_move_at, moves")
      .eq("id", gameId)
      .single();

    if (gameError || !currentGame) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    if (currentGame.status !== "active") {
      return NextResponse.json(
        { error: "Game is not in progress" },
        { status: 400 }
      );
    }

    const { data: players } = await supabase
      .from("game_players")
      .select("player_id, side")
      .eq("game_id", gameId);

    const playerRow = players?.find(
      (p: { player_id: string; side: "white" | "black" | null }) =>
        p.player_id === playerId
    );
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

    let newFen: string;
    let nextActive: "w" | "b";
    let whiteTimeLeft: number;
    let blackTimeLeft: number;

    const currentMoves: string[] = Array.isArray(currentGame.moves)
      ? currentGame.moves
      : typeof currentGame.moves === "object" && currentGame.moves !== null
        ? (Object.values(currentGame.moves) as string[])
        : [];

    if (isUci) {
      const uci = (parsed.data as { uci: string }).uci;
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
      newFen = chess.fen();
      nextActive = chess.turn() as "w" | "b";
      const { whiteTimeLeft: w, blackTimeLeft: b } = computeClocksAfterMove(
        currentWhite,
        currentBlack,
        lastMoveAt,
        currentActive
      );
      whiteTimeLeft = w;
      blackTimeLeft = b;
    } else {
      const legacy = parsed.data as {
        fen: string;
        activeColor: "w" | "b";
        whiteTimeLeft: number;
        blackTimeLeft: number;
        status?: "waiting" | "active" | "finished";
        winner?: "white" | "black" | "draw" | null;
      };
      if (
        legacy.status === "finished" &&
        legacy.winner &&
        legacy.fen === currentFen
      ) {
        newFen = currentFen;
        nextActive = currentActive;
        const { whiteTimeLeft: w, blackTimeLeft: b } = computeClocksAfterMove(
          currentWhite,
          currentBlack,
          lastMoveAt,
          currentActive
        );
        whiteTimeLeft = w;
        blackTimeLeft = b;
      } else {
        let chess: Chess;
        try {
          chess = new Chess(currentFen);
        } catch {
          return NextResponse.json({ error: "Invalid game position" }, { status: 400 });
        }
        const legalMoves = chess.moves({ verbose: true });
        let found = false;
        for (const m of legalMoves) {
          chess.move(m);
          if (chess.fen() === legacy.fen) {
            found = true;
            break;
          }
          chess.undo();
        }
        if (!found) {
          return NextResponse.json(
            { error: "Недопустимый ход или позиция не совпадает с текущей" },
            { status: 400 }
          );
        }
        newFen = chess.fen();
        nextActive = chess.turn() as "w" | "b";
        const { whiteTimeLeft: w, blackTimeLeft: b } = computeClocksAfterMove(
          currentWhite,
          currentBlack,
          lastMoveAt,
          currentActive
        );
        whiteTimeLeft = w;
        blackTimeLeft = b;
      }
    }

    let status: "waiting" | "active" | "finished";
    let winner: "white" | "black" | "draw" | null;
    const computed = computeStatusAndWinner(
      newFen,
      nextActive,
      whiteTimeLeft,
      blackTimeLeft
    );
    status = computed.status;
    winner = computed.winner;

    const newMoves = isUci
      ? [...currentMoves, (parsed.data as { uci: string }).uci]
      : currentMoves;

    const payload = {
      fen: newFen,
      active_color: nextActive,
      white_time_left: whiteTimeLeft,
      black_time_left: blackTimeLeft,
      last_move_at: new Date().toISOString(),
      moves: newMoves,
      status,
      winner: status === "finished" ? winner : null
    };

    const { data, error } = await supabase
      .from("games")
      .update(payload)
      .eq("id", gameId)
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
      await updateRatings(supabase, gameId, data.winner);
    }

    return NextResponse.json({ game: data }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in POST /api/games/[gameId]/move:", error);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status:500 }
    );
  }
}
