import {
  applyIncrement,
  computeClocksAfterElapsed,
} from "@/lib/games/integrity";

export { applyIncrement, computeClocksAfterElapsed };

/** Display interpolation of stored clocks (same contract as the server). */
export function interpolateClocks(
  currentWhite: number,
  currentBlack: number,
  lastMoveAt: string | null,
  sideToMove: "w" | "b"
): { whiteTimeLeft: number; blackTimeLeft: number } {
  return computeClocksAfterElapsed(currentWhite, currentBlack, lastMoveAt, sideToMove);
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
