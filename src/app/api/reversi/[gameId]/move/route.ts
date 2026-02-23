import { NextRequest, NextResponse } from "next/server";
import { getAnonSupabase } from "@/lib/supabase/anon-server";
import { checkRateLimit } from "@/lib/rateLimit";
import { makeMove as reversiMakeMove, getWinner, getValidMoves } from "@/lib/reversi";
import type { Board } from "@/lib/reversi";

type ReversiGameRow = {
  id: string;
  status: string;
  board: Board;
  turn: string;
  black_player_id: string | null;
  white_player_id: string | null;
};

type ReversiGameUpdate = {
  board: Board;
  turn: "black" | "white";
  status: "active" | "finished";
  winner: "black" | "white" | "draw" | null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function samePlayer(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  return a.toLowerCase() === b.toLowerCase();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const supabase = getAnonSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Сервис временно недоступен." }, { status: 503 });
  }

  try {
    const { gameId } = await params;
    if (!UUID_REGEX.test(gameId)) {
      return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const playerId = body.playerId;
    const row = typeof body.row === "number" ? body.row : parseInt(body.row, 10);
    const col = typeof body.col === "number" ? body.col : parseInt(body.col, 10);
    if (!playerId || !UUID_REGEX.test(playerId)) {
      return NextResponse.json({ error: "Укажите playerId (UUID)" }, { status: 400 });
    }
    if (row < 0 || row > 7 || col < 0 || col > 7) {
      return NextResponse.json({ error: "Недопустимая клетка" }, { status: 400 });
    }
    if (!checkRateLimit(playerId)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { data, error: fetchError } = await supabase
      .from("reversi_games")
      .select("id, status, board, turn, black_player_id, white_player_id")
      .eq("id", gameId)
      .single();

    const game = data as ReversiGameRow | null;
    if (fetchError || !game) {
      return NextResponse.json({ error: "Игра не найдена" }, { status: 404 });
    }
    if (game.status !== "active") {
      return NextResponse.json({ error: "Игра не идёт" }, { status: 400 });
    }

    const currentTurn = game.turn as "black" | "white";
    const currentPlayerId = currentTurn === "black" ? game.black_player_id : game.white_player_id;
    if (!samePlayer(currentPlayerId, playerId)) {
      return NextResponse.json({ error: "Не ваш ход" }, { status: 403 });
    }

    const board = game.board as Board;
    const nextBoard = reversiMakeMove(board, row, col, currentTurn);
    if (!nextBoard) {
      return NextResponse.json({ error: "Недопустимый ход" }, { status: 400 });
    }

    let nextTurn: "black" | "white" = currentTurn === "black" ? "white" : "black";
    let finalBoard = nextBoard;
    let winner = getWinner(nextBoard);
    if (!winner && getValidMoves(nextBoard, nextTurn).length === 0) {
      const passTurn = nextTurn === "black" ? "white" : "black";
      if (getValidMoves(nextBoard, passTurn).length > 0) {
        nextTurn = passTurn;
      } else {
        winner = getWinner(nextBoard);
      }
    }

    const updatePayload: ReversiGameUpdate = {
      board: finalBoard,
      turn: nextTurn,
      status: winner ? "finished" : "active",
      winner: winner ?? null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reversi_games not in Supabase generated types
    const { data: updated, error: updateError } = await supabase
      .from("reversi_games")
      .update(updatePayload as any)
      .eq("id", gameId)
      .select("*")
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Не удалось сохранить ход" }, { status: 500 });
    }

    return NextResponse.json({ game: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
