/** Composite rating: 70% competencies + 30% discipline results (when both exist). */
export const COMPOSITE_WEIGHT_COMPETENCY = 0.7;
export const COMPOSITE_WEIGHT_DISCIPLINE = 0.3;

/** Minimum rated competency entries before a student appears in ranked leaderboards. */
export const MIN_RATINGS_FOR_RANK = 3;

export const COMPOSITE_FORMULA_LABEL =
  "Итог = 70% компетенции + 30% дисциплины (только когда заполнены обе части)";

export const COMPOSITE_FORMULA_PARTIAL_LABEL =
  "Пока заполнена только одна часть — итог равен доступной оценке без смешивания весов";

export type CompositeResult = {
  score: number;
  isPartial: boolean;
  mode: "none" | "competency_only" | "discipline_only" | "full";
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function computeCompositeScore(
  competencyOverall: number | null,
  disciplineIndex: number | null
): CompositeResult {
  const c = competencyOverall != null && competencyOverall > 0 ? competencyOverall : null;
  const d = disciplineIndex != null && disciplineIndex > 0 ? disciplineIndex : null;

  if (!c && !d) {
    return { score: 0, isPartial: false, mode: "none" };
  }
  if (c && d) {
    return {
      score: round1(c * COMPOSITE_WEIGHT_COMPETENCY + d * COMPOSITE_WEIGHT_DISCIPLINE),
      isPartial: false,
      mode: "full",
    };
  }
  if (c) {
    return { score: round1(c), isPartial: true, mode: "competency_only" };
  }
  return { score: round1(d!), isPartial: true, mode: "discipline_only" };
}

export function meetsRankingThreshold(ratingsCount: number): boolean {
  return ratingsCount >= MIN_RATINGS_FOR_RANK;
}
