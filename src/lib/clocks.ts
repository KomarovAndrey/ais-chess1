import {
  applyIncrement,
  computeClocksAfterElapsed,
} from "@/lib/games/integrity";

export { applyIncrement, computeClocksAfterElapsed };

/**
 * Lichess-style clock start:
 * clocks stay frozen until White has played the first move (plies > 0).
 * Then Black's clock runs; after each move the opponent's clock runs.
 * The opening move does not consume time and does not receive Fischer increment.
 */
export function clocksAreRunning(
  moves: string[] | null | undefined,
  lastMoveAt: string | null | undefined
): boolean {
  const plies = Array.isArray(moves) ? moves.length : 0;
  return plies > 0 && Boolean(lastMoveAt);
}

/** Display interpolation of stored clocks (same contract as the server). */
export function interpolateClocks(
  currentWhite: number,
  currentBlack: number,
  lastMoveAt: string | null,
  sideToMove: "w" | "b",
  opts?: { moves?: string[] | null; clocksStarted?: boolean }
): { whiteTimeLeft: number; blackTimeLeft: number } {
  const running =
    opts?.clocksStarted ??
    (opts?.moves !== undefined
      ? clocksAreRunning(opts.moves, lastMoveAt)
      : Boolean(lastMoveAt));
  if (!running) {
    return { whiteTimeLeft: currentWhite, blackTimeLeft: currentBlack };
  }
  return computeClocksAfterElapsed(currentWhite, currentBlack, lastMoveAt, sideToMove);
}

/**
 * Clock state right before accepting a move (elapsed deducted if running).
 * Opening position (0 plies): frozen, no deduction.
 */
export function clocksBeforeMove(args: {
  whiteTimeLeft: number;
  blackTimeLeft: number;
  lastMoveAt: string | null;
  sideToMove: "w" | "b";
  movesBefore: string[];
}): {
  whiteTimeLeft: number;
  blackTimeLeft: number;
  clocksWereRunning: boolean;
} {
  const running = clocksAreRunning(args.movesBefore, args.lastMoveAt);
  if (!running) {
    return {
      whiteTimeLeft: args.whiteTimeLeft,
      blackTimeLeft: args.blackTimeLeft,
      clocksWereRunning: false,
    };
  }
  const base = computeClocksAfterElapsed(
    args.whiteTimeLeft,
    args.blackTimeLeft,
    args.lastMoveAt,
    args.sideToMove
  );
  return { ...base, clocksWereRunning: true };
}

/**
 * After a legal move: add Fischer increment only once clocks have already been running
 * (i.e. not on White's opening move — Lichess).
 */
export function clocksAfterLegalMove(args: {
  whiteTimeLeft: number;
  blackTimeLeft: number;
  movedSide: "w" | "b";
  incrementSeconds: number;
  clocksWereRunning: boolean;
}): { whiteTimeLeft: number; blackTimeLeft: number } {
  if (!args.clocksWereRunning) {
    return {
      whiteTimeLeft: args.whiteTimeLeft,
      blackTimeLeft: args.blackTimeLeft,
    };
  }
  return applyIncrement(
    args.whiteTimeLeft,
    args.blackTimeLeft,
    args.movedSide,
    args.incrementSeconds
  );
}

/**
 * Clock label: M:SS above 10s, 0:SS.t with tenths below 10s.
 * Always non-negative.
 */
export function formatClockMs(ms: number): string {
  const t = Math.max(0, Math.floor(ms));
  if (t < 10_000) {
    const totalTenths = Math.floor(t / 100);
    const seconds = Math.floor(totalTenths / 10);
    const tenths = totalTenths % 10;
    return `0:${seconds.toString().padStart(2, "0")}.${tenths}`;
  }
  const totalSeconds = Math.floor(t / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
