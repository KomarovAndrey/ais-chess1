import { NextRequest, NextResponse } from "next/server";
import { getAnonSupabase } from "@/lib/supabase/anon-server";
import { checkRateLimit } from "@/lib/rateLimit";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReversiGameRow = {
  id: string;
  status: string;
  black_player_id: string | null;
  white_player_id: string | null;
};

type ReversiTableUpdate = {
  update: (v: Record<string, unknown>) => { eq: (c: string, id: string) => { select: (s: string) => { single: () => Promise<{ data: unknown; error: unknown }> } } };
};

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
    const gameId = body.gameId;
    const playerId = body.playerId;
    if (!gameId || !playerId || !UUID_REGEX.test(playerId)) {
      return NextResponse.json(
        { error: "Укажите gameId и playerId (UUID) в теле запроса." },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(gameId)) {
      return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
    }
    if (!checkRateLimit(playerId)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { data, error: fetchError } = await supabase
      .from("reversi_games")
      .select("*")
      .eq("id", gameId)
      .single();

    const game = data as ReversiGameRow | null;
    if (fetchError || !game) {
      return NextResponse.json({ error: "Игра не найдена" }, { status: 404 });
    }
    if (game.status !== "waiting") {
      return NextResponse.json({ error: "Игра уже началась" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { status: "active" };
    if (game.black_player_id && !game.white_player_id) {
      updates.white_player_id = playerId;
    } else if (!game.black_player_id && game.white_player_id) {
      updates.black_player_id = playerId;
    } else if (!game.black_player_id && !game.white_player_id) {
      updates.black_player_id = playerId;
    } else {
      return NextResponse.json({ error: "В игре уже два игрока" }, { status: 400 });
    }

    const fromTable = supabase.from("reversi_games") as unknown as ReversiTableUpdate;
    const { data: updated, error: updateError } = await fromTable
      .update(updates)
      .eq("id", gameId)
      .select("*")
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Не удалось присоединиться" }, { status: 500 });
    }

    const side = updates.white_player_id === playerId ? "white" : "black";
    return NextResponse.json({
      game: updated,
      player: { side },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
