/** Недели семестра для детей / soft skills (только 31–40). */
export const MIN_ACTIVE_WEEK = 31;
export const MAX_ACTIVE_WEEK = 40;
export const DEFAULT_ACTIVE_WEEK = MIN_ACTIVE_WEEK;
export const ACTIVE_WEEK_STORAGE_KEY = "active-school-week";

export function normalizeWeekNumber(value: unknown, fallback = DEFAULT_ACTIVE_WEEK) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.trunc(parsed);
  if (rounded < MIN_ACTIVE_WEEK) return MIN_ACTIVE_WEEK;
  if (rounded > MAX_ACTIVE_WEEK) return MAX_ACTIVE_WEEK;
  return rounded;
}

export function weeksExportRange(): number[] {
  return Array.from({ length: MAX_ACTIVE_WEEK - MIN_ACTIVE_WEEK + 1 }, (_, i) => MIN_ACTIVE_WEEK + i);
}

/** Подпись юнита как в отчётной таблице (31–34 → Unit 5, 35–40 → Unit 6). */
export function unitLabelForWeek(week: number): string {
  if (week >= 31 && week <= 34) return "Unit 5";
  if (week >= 35 && week <= 40) return "Unit 6";
  return "";
}
