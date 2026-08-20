import { NextRequest, NextResponse } from "next/server";
import { getSupabaseOptionalUser } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  computeClocksAfterElapsed,
  findPlayer,
  finishActiveGame,
  getGameWriteClient,
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

  try {
    const { gameId } = await params;
    if (!UUID_REGEX.test(gameId)) {
      return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
    }

    let body: { playerId?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const playerId = user?.id ?? body.playerId;
    if (!playerId || (user === null && !body.playerId)) {
      return NextResponse.json(
        { error: "Для игры без входа укажите playerId в теле запроса." },
        { status: 400 }
      );
    }

    if (!checkRateLimit(playerId)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { data: game, error: gameError } = await writeClient
      .from("games")
      .select(
        "id, status, fen, active_color, white_time_left, black_time_left, last_move_at"
      )
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.status !== "active") {
      return NextResponse.json(
        { error: "Сдаться можно только в активной партии" },
        { status: 400 }
      );
    }

    const { data: players } = await writeClient
      .from("game_players")
      .select("player_id, side")
      .eq("game_id", gameId);

    const playerRow = findPlayer(players as GamePlayerRow[] | null, playerId);
    if (!playerRow || (playerRow.side !== "white" && playerRow.side !== "black")) {
      return NextResponse.json(
        { error: "You are not a player in this game" },
        { status: 403 }
      );
    }

    const winner = playerRow.side === "white" ? "black" : "white";
    const activeColor = (game.active_color ?? "w") as "w" | "b";
    const { whiteTimeLeft, blackTimeLeft } = computeClocksAfterElapsed(
      game.white_time_left ?? 0,
      game.black_time_left ?? 0,
      game.last_move_at ?? null,
      activeColor
    );

    const { game: updated } = await finishActiveGame(writeClient, gameId, winner, {
      whiteTimeLeft,
      blackTimeLeft,
      fen: game.fen,
      activeColor,
      clearDrawOffer: true,
    });

    return NextResponse.json({ game: updated });
  } catch (error) {
    console.error("Unexpected error in POST /api/games/[gameId]/resign:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
