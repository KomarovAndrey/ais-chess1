import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";
import { getSupabaseOptionalUser } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { moveBodySchema } from "@/lib/validations/games";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    const { fen, activeColor, whiteTimeLeft, blackTimeLeft } = parsed.data;

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id, status")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    const { data: players } = await supabase
      .from("game_players")
      .select("player_id")
      .eq("game_id", gameId);

    const isPlayer = players?.some((p: { player_id: string }) => p.player_id === playerId);
    if (!isPlayer) {
      return NextResponse.json(
        { error: "You are not a player in this game" },
        { status: 403 }
      );
    }

    const { status, winner } = computeStatusAndWinner(
      fen,
      activeColor,
      whiteTimeLeft,
      blackTimeLeft
    );

    const payload = {
      fen,
      active_color: activeColor,
      white_time_left: whiteTimeLeft,
      black_time_left: blackTimeLeft,
      last_move_at: new Date().toISOString(),
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

    return NextResponse.json({ game: data }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in POST /api/games/[gameId]/move:", error);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
