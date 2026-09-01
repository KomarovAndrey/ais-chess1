import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getGameWriteClient, SERVICE_ROLE_MISSING } from "@/lib/games/integrity";
import { createGameSchema } from "@/lib/validations/games";

export async function POST(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;
  const playerId = user.id;
  const writeClient = getGameWriteClient(supabase);
  if (!writeClient) {
    return NextResponse.json(SERVICE_ROLE_MISSING, { status: 503 });
  }

  try {
    const body = await req.json();
    const parsed = createGameSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const message = Object.values(first).flat().join(" ") || "Validation failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const {
      creatorColor,
      timeControlSeconds,
      incrementSeconds = 0,
      rated: ratedBody = false,
    } = parsed.data;

    if (!await checkRateLimit(playerId)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    // Rated games require profile
    const rated = Boolean(ratedBody);
    if (rated) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile) {
        return NextResponse.json(
          { error: "Для рейтинговой игры нужен профиль." },
          { status: 400 }
        );
      }
    }

    const whiteInitial = timeControlSeconds * 1000;
    const blackInitial = timeControlSeconds * 1000;

    const insertPayload: Record<string, unknown> = {
      status: "waiting",
      fen: "startpos",
      creator_color: creatorColor,
      time_control_seconds: timeControlSeconds,
      active_color: "w",
      white_time_left: whiteInitial,
      black_time_left: blackInitial,
      last_move_at: null,
      increment_seconds: incrementSeconds,
      rated,
      created_by: playerId,
    };

    let { data: game, error: gameError } = await writeClient
      .from("games")
      .insert(insertPayload)
      .select("*")
      .single();

    // Backward-compatible if migration not applied yet
    if (
      gameError &&
      (gameError.message?.includes("increment_seconds") ||
        gameError.message?.includes("rated") ||
        gameError.message?.includes("created_by"))
    ) {
      const legacy = { ...insertPayload };
      delete legacy.increment_seconds;
      delete legacy.rated;
      delete legacy.created_by;
      const retry = await writeClient.from("games").insert(legacy).select("*").single();
      game = retry.data;
      gameError = retry.error;
    }

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
      const { data: player, error: playerError } = await writeClient
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
