import { NextRequest, NextResponse } from "next/server";
import { getSupabaseOptionalUser } from "@/lib/apiAuth";
import {
  getGameWriteClient,
  SERVICE_ROLE_MISSING,
} from "@/lib/games/integrity";
import { syncActiveGameClocks } from "@/lib/games/syncClocks";
import { clocksAreRunning } from "@/lib/clocks";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Authoritative game snapshot with live clocks.
 * Elapsed time is computed from last_move_at on the server (wall clock),
 * so flags fall even when no browser tab is open.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const auth = await getSupabaseOptionalUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
  const writeClient = getGameWriteClient(supabase);
  if (!writeClient) {
    return NextResponse.json(SERVICE_ROLE_MISSING, { status: 503 });
  }

  const { gameId } = await params;
  if (!UUID_REGEX.test(gameId)) {
    return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  }

  try {
    const { data: game, error } = await writeClient
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (error || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const synced = await syncActiveGameClocks(writeClient, game);
    const serverNow = new Date().toISOString();
    const moves = Array.isArray(synced.game.moves)
      ? (synced.game.moves as string[])
      : [];
    const running =
      synced.game.status === "active" &&
      !synced.timedOut &&
      clocksAreRunning(moves, (game as { last_move_at?: string | null }).last_move_at);

    const responseGame = running
      ? {
          ...synced.game,
          white_time_left: synced.whiteTimeLeft,
          black_time_left: synced.blackTimeLeft,
          last_move_at: serverNow,
        }
      : {
          ...synced.game,
          white_time_left: synced.whiteTimeLeft,
          black_time_left: synced.blackTimeLeft,
        };

    return NextResponse.json({
      game: responseGame,
      timedOut: synced.timedOut,
      serverNow,
    });
  } catch (error) {
    console.error("GET /api/games/[gameId]:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
