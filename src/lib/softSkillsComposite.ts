/** Composite rating: 70% competencies + 30% discipline results. */
export const COMPOSITE_WEIGHT_COMPETENCY = 0.7;
export const COMPOSITE_WEIGHT_DISCIPLINE = 0.3;

/** Minimum rated entries before a student appears in ranked leaderboards. */
export const MIN_RATINGS_FOR_RANK = 3;

export const COMPOSITE_FORMULA_LABEL =
  "Итог = 70% среднее компетенций + 30% индекс дисциплин (шкала 0–5)";

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function computeCompositeScore(
  competencyOverall: number | null,
  disciplineIndex: number | null
): number {
  const c = competencyOverall ?? 0;
  const d = disciplineIndex ?? 0;
  if (c <= 0 && d <= 0) return 0;
  if (d <= 0) return round1(c);
  if (c <= 0) return round1(d);
  return round1(c * COMPOSITE_WEIGHT_COMPETENCY + d * COMPOSITE_WEIGHT_DISCIPLINE);
}

export function meetsRankingThreshold(ratingsCount: number): boolean {
  return ratingsCount >= MIN_RATINGS_FOR_RANK;
}
