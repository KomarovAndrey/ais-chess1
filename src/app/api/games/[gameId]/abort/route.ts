import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  findPlayer,
  getGameWriteClient,
  SERVICE_ROLE_MISSING,
  requireAuthForRated,
  type GamePlayerRow,
} from "@/lib/games/integrity";
import { ABORT_MAX_PLIES } from "@/lib/timeControls";
import { voidBroadcastGameUpdate } from "@/lib/games/broadcast";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Abort waiting game, or active game with fewer than ABORT_MAX_PLIES moves. No rating. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;
  const playerId = user.id;
  const writeClient = getGameWriteClient(supabase);
  if (!writeClient) {
    return NextResponse.json(SERVICE_ROLE_MISSING, { status: 503 });
  }

  try {
    await req.json().catch(() => ({}));

    if (!await checkRateLimit(playerId)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { gameId } = await params;
    if (!UUID_REGEX.test(gameId)) {
      return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
    }

    const { data: game, error: gameError } = await writeClient
      .from("games")
      .select("id, status, moves, created_by, rated")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const ratedBlock = requireAuthForRated(game.rated, user);
    if (ratedBlock) {
      return NextResponse.json({ error: ratedBlock }, { status: 401 });
    }

    const { data: players } = await writeClient
      .from("game_players")
      .select("player_id, side")
      .eq("game_id", gameId);

    const playerRow = findPlayer(players as GamePlayerRow[] | null, playerId);
    const isCreator =
      typeof game.created_by === "string" && game.created_by === playerId;

    if (game.status === "waiting") {
      // Only a seated player or the creator may cancel a waiting game
      if (!playerRow && !isCreator) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { data, error } = await writeClient
        .from("games")
        .update({
          status: "aborted",
          end_reason: "abort",
          winner: null,
          ratings_applied: true,
        })
        .eq("id", gameId)
        .eq("status", "waiting")
        .select("*")
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "Failed to abort" }, { status: 500 });
      }
      voidBroadcastGameUpdate(gameId, data, "game");
      return NextResponse.json({ game: data });
    }

    if (game.status !== "active") {
      return NextResponse.json({ error: "Game cannot be aborted" }, { status: 400 });
    }

    if (!playerRow) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const moves: string[] = Array.isArray(game.moves) ? game.moves : [];
    if (moves.length >= ABORT_MAX_PLIES) {
      return NextResponse.json(
        { error: "Слишком поздно для отмены. Сдайтесь или предложите ничью." },
        { status: 400 }
      );
    }

    const { data, error } = await writeClient
      .from("games")
      .update({
        status: "aborted",
        end_reason: "abort",
        winner: null,
        ratings_applied: true,
        draw_offer_from: null,
      })
      .eq("id", gameId)
      .eq("status", "active")
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Failed to abort" }, { status: 500 });
    }

    voidBroadcastGameUpdate(gameId, data, "game");
    return NextResponse.json({ game: data });
  } catch (e) {
    console.error("POST abort:", e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
