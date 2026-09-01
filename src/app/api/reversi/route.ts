import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { createInitialBoard } from "@/lib/reversi";
import type { Board } from "@/lib/reversi";

type ReversiMove = { row: number; col: number; player: "black" | "white" };

type ReversiGameInsert = {
  status: string;
  board: Board;
  turn: string;
  creator_side: string;
  black_player_id: string | null;
  white_player_id: string | null;
  moves: ReversiMove[];
};

type ReversiTableInsert = {
  insert: (v: ReversiGameInsert) => { select: (s: string) => { single: () => Promise<{ data: unknown; error: unknown }> } };
};

export async function POST(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const creatorSide = body.creatorSide === "white" ? "white" : body.creatorSide === "black" ? "black" : "random";
    const playerId = user.id;

    if (!await checkRateLimit(playerId)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const initialBoard = createInitialBoard();
    let blackPlayerId: string | null = null;
    let whitePlayerId: string | null = null;
    if (creatorSide === "black") {
      blackPlayerId = playerId;
    } else if (creatorSide === "white") {
      whitePlayerId = playerId;
    } else {
      blackPlayerId = playerId;
    }

    const insertPayload: ReversiGameInsert = {
      status: "waiting",
      board: initialBoard,
      turn: "black",
      creator_side: creatorSide,
      black_player_id: blackPlayerId,
      white_player_id: whitePlayerId,
      moves: [],
    };
    const fromTable = supabase.from("reversi_games") as unknown as ReversiTableInsert;
    const { data: game, error } = await fromTable
      .insert(insertPayload)
      .select("id, status, board, turn, creator_side, black_player_id, white_player_id")
      .single();

    if (error || !game) {
      console.error("reversi create error:", error);
      return NextResponse.json({ error: "Не удалось создать игру" }, { status: 500 });
    }

    const created = game as { id: string };
    return NextResponse.json(
      { gameId: created.id, url: `/reversi/play/${created.id}` },
      { status: 201 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
