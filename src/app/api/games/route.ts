import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

type CreatorColor = "white" | "black" | "random";

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const {
      creatorColor,
      timeControlSeconds,
      playerId
    }: {
      creatorColor: CreatorColor;
      timeControlSeconds: number;
      playerId: string;
    } = body;

    if (!playerId || !timeControlSeconds || !creatorColor) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const normalizedColor: CreatorColor =
      creatorColor === "white" || creatorColor === "black"
        ? creatorColor
        : "random";

    const whiteInitial = timeControlSeconds * 1000;
    const blackInitial = timeControlSeconds * 1000;

    const { data: game, error: gameError } = await supabase
      .from("games")
      .insert({
        status: "waiting",
        fen: "startpos",
        creator_color: normalizedColor,
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
      const message = gameError?.message ?? "Failed to create game";
      const msg = (gameError?.message ?? "").toLowerCase();
      const hint =
        gameError?.code === "PGRST301" ||
        gameError?.code === "42P01" ||
        msg.includes("relation") ||
        msg.includes("schema cache")
          ? " Create tables: Supabase Dashboard → SQL Editor → run supabase-schema-games.sql"
          : "";
      return NextResponse.json(
        { error: message + hint },
        { status: 500 }
      );
    }

    // Determine creator side
    let side: "white" | "black" | null = null;
    if (normalizedColor === "white") side = "white";
    else if (normalizedColor === "black") side = "black";

    let playerRecord = null;

    if (side) {
      const { data: player, error: playerError } = await supabase
        .from("game_players")
        .insert({
          game_id: game.id,
          side,
          player_id: playerId
        } as any)
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

