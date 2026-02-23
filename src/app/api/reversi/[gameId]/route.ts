import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  if (!UUID_REGEX.test(gameId)) {
    return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { data: game, error } = await supabase
    .from("reversi_games")
    .select("id, status, board, turn, winner, black_player_id, white_player_id, creator_side")
    .eq("id", gameId)
    .single();

  if (error || !game) {
    return NextResponse.json({ error: "Игра не найдена" }, { status: 404 });
  }

  return NextResponse.json(game);
}
