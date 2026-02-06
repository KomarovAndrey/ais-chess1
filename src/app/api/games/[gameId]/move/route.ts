import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 }
    );
  }

  const { gameId } = await params;

  try {
    const body = await req.json();
    const {
      fen,
      activeColor,
      whiteTimeLeft,
      blackTimeLeft,
      status,
      winner
    }: {
      fen: string;
      activeColor: "w" | "b";
      whiteTimeLeft: number;
      blackTimeLeft: number;
      status: "waiting" | "active" | "finished";
      winner?: "white" | "black" | "draw" | null;
    } = body;

    if (!fen || !gameId) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    const payload: any = {
      fen,
      active_color: activeColor,
      white_time_left: whiteTimeLeft,
      black_time_left: blackTimeLeft,
      last_move_at: new Date().toISOString(),
      status
    };

    if (status === "finished") {
      payload.winner = winner ?? null;
    }

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

