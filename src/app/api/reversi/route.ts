import { NextRequest, NextResponse } from "next/server";
import { getAnonSupabase } from "@/lib/supabase/anon-server";
import { checkRateLimit } from "@/lib/rateLimit";
import { createInitialBoard } from "@/lib/reversi";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const supabase = getAnonSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Сервис временно недоступен. Настройте Supabase (NEXT_PUBLIC_SUPABASE_*)." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const creatorSide = body.creatorSide === "white" ? "white" : body.creatorSide === "black" ? "black" : "random";
    const playerId = body.playerId;
    if (!playerId || !UUID_REGEX.test(playerId)) {
      return NextResponse.json(
        { error: "Укажите playerId (UUID) в теле запроса для игры по ссылке." },
        { status: 400 }
      );
    }

    if (!checkRateLimit(playerId)) {
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

    const { data: game, error } = await supabase
      .from("reversi_games")
      .insert({
        status: "waiting",
        board: initialBoard,
        turn: "black",
        creator_side: creatorSide,
        black_player_id: blackPlayerId,
        white_player_id: whitePlayerId,
      })
      .select("id, status, board, turn, creator_side, black_player_id, white_player_id")
      .single();

    if (error || !game) {
      console.error("reversi create error:", error);
      return NextResponse.json({ error: "Не удалось создать игру" }, { status: 500 });
    }

    return NextResponse.json(
      { gameId: game.id, url: `/reversi/play/${game.id}` },
      { status: 201 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
