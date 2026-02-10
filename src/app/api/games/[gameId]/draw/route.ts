import { NextRequest, NextResponse } from "next/server";
import { getSupabaseOptionalUser } from "@/lib/apiAuth";

type GameStatus = "waiting" | "active" | "finished";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const auth = await getSupabaseOptionalUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const { gameId } = await params;

  let body: { action?: "offer" | "decline"; playerId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bodyPlayerId = body.playerId;
  const effectivePlayerId = user?.id ?? bodyPlayerId ?? null;
  if (!effectivePlayerId) {
    return NextResponse.json(
      { error: "playerId is required for anonymous players" },
      { status: 400 }
    );
  }

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select<{
      id: string;
      status: GameStatus;
      draw_offer_from: string | null;
    }>("id, status, draw_offer_from")
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (game.status !== "active") {
    return NextResponse.json(
      { error: "Ничья доступна только в активной партии" },
      { status: 400 }
    );
  }

  const { data: players } = await supabase
    .from("game_players")
    .select<{ player_id: string }>("player_id")
    .eq("game_id", gameId);

  const isPlayer = players?.some((p) => p.player_id === effectivePlayerId);
  if (!isPlayer) {
    return NextResponse.json(
      { error: "You are not a player in this game" },
      { status: 403 }
    );
  }

  const action = body.action ?? "offer";

  if (action === "offer") {
    const { data: updated, error: updateError } = await supabase
      .from("games")
      .update({ draw_offer_from: effectivePlayerId })
      .eq("id", gameId)
      .select("id, status, draw_offer_from")
      .single();

    if (updateError || !updated) {
      console.error("Offer draw update error:", updateError);
      return NextResponse.json(
        { error: "Не удалось предложить ничью" },
        { status: 500 }
      );
    }

    return NextResponse.json({ game: updated });
  }

  if (action === "decline") {
    const { data: updated, error: updateError } = await supabase
      .from("games")
      .update({ draw_offer_from: null })
      .eq("id", gameId)
      .select("id, status, draw_offer_from")
      .single();

    if (updateError || !updated) {
      console.error("Decline draw update error:", updateError);
      return NextResponse.json(
        { error: "Не удалось отклонить ничью" },
        { status: 500 }
      );
    }

    return NextResponse.json({ game: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

