import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function POST(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const {
      gameId,
      playerId
    }: {
      gameId: string;
      playerId: string;
    } = body;

    if (!gameId || !playerId) {
      return NextResponse.json(
        { error: "Missing gameId or playerId" },
        { status: 400 }
      );
    }

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    // Load existing players
    const { data: players, error: playersError } = await supabase
      .from("game_players")
      .select("*")
      .eq("game_id", gameId);

    if (playersError) {
      console.error("Error loading players:", playersError);
      return NextResponse.json(
        { error: "Failed to load players" },
        { status: 500 }
      );
    }

    // If player already joined, just return their record
    const existing = players?.find((p: any) => p.player_id === playerId);
    if (existing) {
      return NextResponse.json(
        {
          game,
          player: existing
        },
        { status: 200 }
      );
    }

    const hasWhite = players?.some((p: any) => p.side === "white");
    const hasBlack = players?.some((p: any) => p.side === "black");

    if (hasWhite && hasBlack) {
      return NextResponse.json(
        { error: "Game is full" },
        { status: 400 }
      );
    }

    let side: "white" | "black";

    if (!hasWhite && !hasBlack) {
      // First joiner, follow creator_color or random
      if (game.creator_color === "white") side = "white";
      else if (game.creator_color === "black") side = "black";
      else side = Math.random() < 0.5 ? "white" : "black";
    } else if (!hasWhite) {
      side = "white";
    } else {
      side = "black";
    }

    const { data: player, error: insertError } = await supabase
      .from("game_players")
      .insert({
        game_id: gameId,
        side,
        player_id: playerId
      } as any)
      .select("*")
      .single();

    if (insertError || !player) {
      console.error("Error creating player:", insertError);
      return NextResponse.json(
        { error: "Failed to join game" },
        { status: 500 }
      );
    }

    // If now two players, mark game active and started_at
    const totalPlayers = (players?.length ?? 0) + 1;
    if (totalPlayers >= 2 && game.status === "waiting") {
      await supabase
        .from("games")
        .update({
          status: "active",
          started_at: new Date().toISOString(),
          last_move_at: new Date().toISOString()
        })
        .eq("id", gameId);
    }

    return NextResponse.json(
      {
        game: {
          ...game,
          status:
            totalPlayers >= 2 && game.status === "waiting"
              ? "active"
              : game.status
        },
        player
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/games/join:", error);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}

