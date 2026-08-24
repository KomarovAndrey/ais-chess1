/** Shared time-control presets and helpers (Phase A). */

export type TimePreset = {
  seconds: number;
  increment: number;
  label: string;
  group: "Bullet" | "Blitz" | "Rapid";
};

export const TIME_PRESETS: TimePreset[] = [
  { seconds: 60, increment: 0, label: "1+0", group: "Bullet" },
  { seconds: 120, increment: 1, label: "2+1", group: "Bullet" },
  { seconds: 180, increment: 0, label: "3+0", group: "Blitz" },
  { seconds: 180, increment: 2, label: "3+2", group: "Blitz" },
  { seconds: 300, increment: 0, label: "5+0", group: "Blitz" },
  { seconds: 300, increment: 3, label: "5+3", group: "Blitz" },
  { seconds: 600, increment: 0, label: "10+0", group: "Rapid" },
  { seconds: 900, increment: 10, label: "15+10", group: "Rapid" },
];

export function formatTimeControl(seconds: number, increment = 0): string {
  const min = Math.floor(seconds / 60);
  if (increment > 0) return `${min}+${increment}`;
  return `${min}+0`;
}

export function ratingCategoryFromTimeControlSeconds(
  t: number | null | undefined
): "bullet" | "blitz" | "rapid" {
  const v = typeof t === "number" && Number.isFinite(t) ? t : 300;
  if (v <= 120) return "bullet";
  if (v <= 300) return "blitz";
  return "rapid";
}

/** Max half-moves before abort is no longer allowed (exclusive). */
export const ABORT_MAX_PLIES = 2;
