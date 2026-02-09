import { NextRequest, NextResponse } from "next/server";
import { getSupabaseOptionalUser } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { createGameSchema } from "@/lib/validations/games";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const auth = await getSupabaseOptionalUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  try {
    const body = await req.json();
    const parsed = createGameSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const message = Object.values(first).flat().join(" ") || "Validation failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { creatorColor, timeControlSeconds, playerId: bodyPlayerId } = parsed.data;
    const playerId = user?.id ?? bodyPlayerId;
    if (!playerId || (user === null && (!bodyPlayerId || !UUID_REGEX.test(bodyPlayerId)))) {
      return NextResponse.json(
        { error: "Для игры без входа укажите playerId (UUID) в теле запроса." },
        { status: 400 }
      );
    }

    if (!checkRateLimit(playerId)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    const whiteInitial = timeControlSeconds * 1000;
    const blackInitial = timeControlSeconds * 1000;

    const { data: game, error: gameError } = await supabase
      .from("games")
      .insert({
        status: "waiting",
        fen: "startpos",
        creator_color: creatorColor,
        time_control_seconds: timeControlSeconds,
        active_color: "w",
        white_time_left: whiteInitial,
        black_time_left: blackInitial,
        last_move_at: null
      })
      .select("*")
      .single();

    if (gameError || !game) {
      console.error("Error creating game:", gameError);
      return NextResponse.json(
        { error: "Failed to create game" },
        { status: 500 }
      );
    }

    let side: "white" | "black" | null = null;
    if (creatorColor === "white") side = "white";
    else if (creatorColor === "black") side = "black";

    let playerRecord = null;

    if (side) {
      const { data: player, error: playerError } = await supabase
        .from("game_players")
        .insert({
          game_id: game.id,
          side,
          player_id: playerId
        })
        .select("*")
        .single();

      if (playerError) {
        console.error("Error creating game_players:", playerError);
      } else {
        playerRecord = player;
      }
    }

    return NextResponse.json(
      {
        gameId: game.id,
        player: playerRecord,
        url: `/play/${game.id}`
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/games:", error);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
