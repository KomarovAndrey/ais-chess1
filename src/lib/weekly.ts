export const DEFAULT_ACTIVE_WEEK = 30;
export const ACTIVE_WEEK_STORAGE_KEY = "active-school-week";

export function normalizeWeekNumber(value: unknown, fallback = DEFAULT_ACTIVE_WEEK) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.trunc(parsed);
  return rounded >= DEFAULT_ACTIVE_WEEK ? rounded : fallback;
}
