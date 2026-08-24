import { NextRequest, NextResponse } from "next/server";
import { getSupabaseOptionalUser } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  computeClocksAfterElapsed,
  findPlayer,
  finishActiveGame,
  getGameWriteClient,
  SERVICE_ROLE_MISSING,
  requireAuthForRated,
  type GamePlayerRow,
} from "@/lib/games/integrity";

type GameStatus = "waiting" | "active" | "finished";

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
  if (!writeClient) {
    return NextResponse.json(SERVICE_ROLE_MISSING, { status: 503 });
  }

  const { gameId } = await params;
  if (!UUID_REGEX.test(gameId)) {
    return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  }

  let body: { action?: "offer" | "decline" | "accept"; playerId?: string };
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

  if (!await checkRateLimit(effectivePlayerId)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { data, error: gameError } = await writeClient
    .from("games")
    .select(
      "id, status, fen, active_color, white_time_left, black_time_left, last_move_at, draw_offer_from, rated"
    )
    .eq("id", gameId)
    .single();

  if (gameError || !data) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const ratedBlock = requireAuthForRated((data as { rated?: boolean }).rated, user);
  if (ratedBlock) {
    return NextResponse.json({ error: ratedBlock }, { status: 401 });
  }

  const game = data as {
    id: string;
    status: GameStatus;
    fen: string;
    active_color: "w" | "b";
    white_time_left: number;
    black_time_left: number;
    last_move_at: string | null;
    draw_offer_from: string | null;
  };

  if (game.status !== "active") {
    return NextResponse.json(
      { error: "Ничья доступна только в активной партии" },
      { status: 400 }
    );
  }

  const { data: playersData } = await writeClient
    .from("game_players")
    .select("player_id, side")
    .eq("game_id", gameId);

  const players = playersData as GamePlayerRow[] | null;
  const playerRow = findPlayer(players, effectivePlayerId);
  if (!playerRow) {
    return NextResponse.json(
      { error: "You are not a player in this game" },
      { status: 403 }
    );
  }

  const action = body.action ?? "offer";

  if (action === "offer") {
    if (game.draw_offer_from === effectivePlayerId) {
      return NextResponse.json({
        game: {
          id: game.id,
          status: game.status,
          draw_offer_from: game.draw_offer_from,
        },
      });
    }

    const { data: updated, error: updateError } = await writeClient
      .from("games")
      .update({ draw_offer_from: effectivePlayerId })
      .eq("id", gameId)
      .eq("status", "active")
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
    if (!game.draw_offer_from || game.draw_offer_from === effectivePlayerId) {
      return NextResponse.json(
        { error: "Нет предложения ничьей для отклонения" },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await writeClient
      .from("games")
      .update({ draw_offer_from: null })
      .eq("id", gameId)
      .eq("status", "active")
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

  if (action === "accept") {
    if (!game.draw_offer_from) {
      return NextResponse.json(
        { error: "Нет предложения ничьей" },
        { status: 400 }
      );
    }
    if (game.draw_offer_from === effectivePlayerId) {
      return NextResponse.json(
        { error: "Нельзя принять собственное предложение ничьей" },
        { status: 400 }
      );
    }

    const activeColor = (game.active_color ?? "w") as "w" | "b";
    const { whiteTimeLeft, blackTimeLeft } = computeClocksAfterElapsed(
      game.white_time_left ?? 0,
      game.black_time_left ?? 0,
      game.last_move_at ?? null,
      activeColor
    );

    try {
      const { game: updated } = await finishActiveGame(writeClient, gameId, "draw", {
        whiteTimeLeft,
        blackTimeLeft,
        fen: game.fen,
        activeColor,
        clearDrawOffer: true,
      });
      return NextResponse.json({ game: updated });
    } catch (error) {
      console.error("Accept draw error:", error);
      return NextResponse.json(
        { error: "Не удалось принять ничью" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
