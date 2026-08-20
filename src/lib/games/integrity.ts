import type { SupabaseClient } from "@supabase/supabase-js";
import { Chess } from "chess.js";
import { createAdminClient } from "@/lib/supabase/admin";

export type GameWinner = "white" | "black" | "draw";
export type GameStatus = "waiting" | "active" | "finished";

export type GamePlayerRow = { player_id: string; side: "white" | "black" | null };

/**
 * Client used for authoritative game writes.
 * Prefers service role; falls back to the request-scoped client until the key is configured.
 */
export function getGameWriteClient(fallback: SupabaseClient): SupabaseClient {
  return createAdminClient() ?? fallback;
}

export function computeClocksAfterElapsed(
  currentWhite: number,
  currentBlack: number,
  lastMoveAt: string | null,
  sideToMove: "w" | "b"
): { whiteTimeLeft: number; blackTimeLeft: number } {
  let white = currentWhite;
  let black = currentBlack;
  const elapsed = lastMoveAt
    ? Math.max(0, Date.now() - new Date(lastMoveAt).getTime())
    : 0;
  if (sideToMove === "w") {
    white = Math.max(0, currentWhite - elapsed);
  } else {
    black = Math.max(0, currentBlack - elapsed);
  }
  return { whiteTimeLeft: white, blackTimeLeft: black };
}

export function computeStatusAndWinner(
  fen: string,
  whiteTimeLeft: number,
  blackTimeLeft: number
): { status: GameStatus; winner: GameWinner | null } {
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

export async function applyGameRatings(
  writeClient: SupabaseClient,
  gameId: string,
  winner: GameWinner
): Promise<void> {
  const { error } = await writeClient.rpc("update_game_ratings", {
    p_game_id: gameId,
    p_winner: winner,
  });
  if (error) {
    console.error("update_game_ratings failed:", error);
    // Do not throw: the game is already finished. Fix SERVICE_ROLE / SQL and re-run if needed.
  }
}

/** Finish an active game with a server-chosen winner and apply ratings once. */
export async function finishActiveGame(
  writeClient: SupabaseClient,
  gameId: string,
  winner: GameWinner,
  extra: {
    whiteTimeLeft?: number;
    blackTimeLeft?: number;
    fen?: string;
    activeColor?: "w" | "b";
    clearDrawOffer?: boolean;
  } = {}
): Promise<{ game: Record<string, unknown> }> {
  const payload: Record<string, unknown> = {
    status: "finished",
    winner,
    last_move_at: new Date().toISOString(),
  };
  if (extra.whiteTimeLeft !== undefined) payload.white_time_left = extra.whiteTimeLeft;
  if (extra.blackTimeLeft !== undefined) payload.black_time_left = extra.blackTimeLeft;
  if (extra.fen !== undefined) payload.fen = extra.fen;
  if (extra.activeColor !== undefined) payload.active_color = extra.activeColor;
  if (extra.clearDrawOffer) payload.draw_offer_from = null;

  const { data, error } = await writeClient
    .from("games")
    .update(payload)
    .eq("id", gameId)
    .eq("status", "active")
    .select("*")
    .single();

  if (error || !data) {
    console.error("finishActiveGame update error:", error);
    throw new Error("Failed to finish game");
  }

  await applyGameRatings(writeClient, gameId, winner);
  return { game: data as Record<string, unknown> };
}

export function findPlayer(
  players: GamePlayerRow[] | null | undefined,
  playerId: string
): GamePlayerRow | undefined {
  return players?.find((p) => p.player_id === playerId);
}
