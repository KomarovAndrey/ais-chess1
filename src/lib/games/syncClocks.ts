import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clocksAreRunning,
  interpolateClocks,
} from "@/lib/clocks";
import { finishActiveGame } from "@/lib/games/integrity";

export type GameClockFields = {
  id: string;
  status: string;
  fen: string | null;
  active_color: "w" | "b" | null;
  white_time_left: number | null;
  black_time_left: number | null;
  last_move_at: string | null;
  moves?: unknown;
  [key: string]: unknown;
};

function movesOf(game: GameClockFields): string[] {
  if (Array.isArray(game.moves)) return game.moves as string[];
  if (typeof game.moves === "object" && game.moves !== null) {
    return Object.values(game.moves) as string[];
  }
  return [];
}

/**
 * Server-side clock sync (Lichess-style wall clock).
 * Elapsed time is always derived from last_move_at — independent of open tabs.
 * If a side has run out, the game is finished here.
 */
export async function syncActiveGameClocks(
  writeClient: SupabaseClient,
  game: GameClockFields
): Promise<{
  game: GameClockFields;
  whiteTimeLeft: number;
  blackTimeLeft: number;
  timedOut: boolean;
}> {
  const whiteStored = game.white_time_left ?? 0;
  const blackStored = game.black_time_left ?? 0;

  if (game.status !== "active") {
    return {
      game,
      whiteTimeLeft: whiteStored,
      blackTimeLeft: blackStored,
      timedOut: false,
    };
  }

  const moves = movesOf(game);
  const lastMoveAt = game.last_move_at ?? null;
  const activeColor = (game.active_color ?? "w") as "w" | "b";

  if (!clocksAreRunning(moves, lastMoveAt)) {
    return {
      game,
      whiteTimeLeft: whiteStored,
      blackTimeLeft: blackStored,
      timedOut: false,
    };
  }

  const { whiteTimeLeft, blackTimeLeft } = interpolateClocks(
    whiteStored,
    blackStored,
    lastMoveAt,
    activeColor,
    { moves }
  );

  if (whiteTimeLeft > 0 && blackTimeLeft > 0) {
    return { game, whiteTimeLeft, blackTimeLeft, timedOut: false };
  }

  const winner = whiteTimeLeft <= 0 ? "black" : "white";
  const { game: finished } = await finishActiveGame(writeClient, game.id, winner, {
    whiteTimeLeft,
    blackTimeLeft,
    fen: game.fen ?? undefined,
    activeColor,
    clearDrawOffer: true,
  });

  return {
    game: finished as GameClockFields,
    whiteTimeLeft,
    blackTimeLeft,
    timedOut: true,
  };
}
