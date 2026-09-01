import {
  aggregateCompetencies,
  type CompetencySnapshot,
  type DisciplineEntryRow,
} from "@/lib/softSkillsCompetencies";
import { maxPossibleRatings } from "@/lib/softSkillsCoverage";
import {
  SOFT_SKILLS_DISCIPLINES,
  SOFT_SKILLS_STAR_SKILLS,
  getDisciplineLabel,
  type SoftSkillsDisciplineId,
} from "@/lib/softSkillsDisciplines";
import { SOFT_SKILLS_MODULES, type SoftSkillsModuleId } from "@/lib/softSkillsModules";
import {
  aggregateDisciplineIndex,
  type FullDisciplineEntryRow,
  type LeagueProfile,
} from "@/lib/softSkillsDisciplineIndex";
import { computeCompositeScore } from "@/lib/softSkillsComposite";

export type TrendPoint = {
  label: string;
  weekNumber?: number;
  moduleId?: string;
  competencyOverall: number | null;
  composite: number | null;
};

export type CompetencyInsight = {
  strongest: { id: string; label: string; value: number } | null;
  weakest: { id: string; label: string; value: number } | null;
  trend: "up" | "down" | "stable" | null;
  trendDelta: number | null;
  coverageLabel: string;
};

export type DisciplineStatRow = {
  discipline: SoftSkillsDisciplineId;
  label: string;
  entriesCount: number;
  winRate: number | null;
  indexScore: number | null;
  groupMedianIndex: number | null;
  detail: string;
};

export function buildTrendByWeek(
  entries: DisciplineEntryRow[],
  fullEntries: FullDisciplineEntryRow[],
  profiles: LeagueProfile[],
  userId: string,
  moduleId?: string
): TrendPoint[] {
  const filtered = fullEntries.filter((e) => {
    if (e.user_id !== userId) return false;
    if (moduleId && e.module_id !== moduleId) return false;
    return true;
  });

  const weeks = [...new Set(filtered.map((e) => e.week_number))].sort((a, b) => a - b);

  return weeks.map((week) => {
    const weekStarRows = entries.filter(
      (e) =>
        e.user_id === userId &&
        e.week_number === week &&
        (!moduleId || e.module_id === moduleId)
    );
    const weekFullRows = filtered.filter((e) => e.week_number === week);
    const weekComp = aggregateCompetencies(weekStarRows);
    const weekDisc = aggregateDisciplineIndex(weekFullRows, profiles);
    const composite = computeCompositeScore(weekComp.overall, weekDisc.overall);
    return {
      label: `Нед. ${week}`,
      weekNumber: week,
      moduleId,
      competencyOverall: weekComp.overall,
      composite: composite.score > 0 ? composite.score : null,
    };
  });
}

export function buildTrendByModule(
  entries: DisciplineEntryRow[],
  fullEntries: FullDisciplineEntryRow[],
  profiles: LeagueProfile[],
  userId: string
): TrendPoint[] {
  return SOFT_SKILLS_MODULES.map((m) => {
    const comp = aggregateCompetencies(entries, { userId, moduleId: m.id });
    const disc = aggregateDisciplineIndex(fullEntries, profiles, { userId, moduleId: m.id });
    const composite = computeCompositeScore(comp.overall, disc.overall);
    return {
      label: m.label,
      moduleId: m.id,
      competencyOverall: comp.overall,
      composite: composite.score > 0 ? composite.score : null,
    };
  });
}

export function buildHeatmapData(
  entries: DisciplineEntryRow[],
  userId: string
): {
  modules: { id: string; label: string }[];
  skills: { id: string; label: string }[];
  values: (number | null)[][];
} {
  const modules = SOFT_SKILLS_MODULES.map((m) => ({ id: m.id, label: m.label }));
  const skills = SOFT_SKILLS_STAR_SKILLS.map((s) => ({ id: s.id, label: s.label }));
  const values = skills.map((skill) =>
    modules.map((mod) => {
      const snap = aggregateCompetencies(entries, {
        userId,
        moduleId: mod.id as SoftSkillsModuleId,
      });
      return snap[skill.id as keyof CompetencySnapshot] as number | null;
    })
  );
  return { modules, skills, values };
}

export function buildCompetencyInsights(
  entries: DisciplineEntryRow[],
  userId: string,
  moduleId?: string
): CompetencyInsight {
  const snap = aggregateCompetencies(entries, { userId, moduleId });
  const rated = SOFT_SKILLS_STAR_SKILLS.flatMap((s) => {
    const value = snap[s.id];
    return value != null ? [{ id: s.id, label: s.label, value }] : [];
  });

  const strongest =
    rated.length > 0 ? rated.reduce((best, cur) => (cur.value > best.value ? cur : best)) : null;
  const weakest =
    rated.length > 0 ? rated.reduce((worst, cur) => (cur.value < worst.value ? cur : worst)) : null;

  const filtered = entries.filter((e) => {
    if (e.user_id !== userId) return false;
    if (moduleId && e.module_id !== moduleId) return false;
    return true;
  });
  const weekKeys = [...new Set(filtered.map((e) => `${e.module_id}:${e.week_number}`))].sort();
  const recentKeys = weekKeys.slice(-4);
  const olderKeys = weekKeys.slice(0, Math.max(0, weekKeys.length - 4));

  let trend: "up" | "down" | "stable" | null = null;
  let trendDelta: number | null = null;

  if (recentKeys.length >= 1 && olderKeys.length > 0) {
    const recentEntries = filtered.filter((e) =>
      recentKeys.includes(`${e.module_id}:${e.week_number}`)
    );
    const olderEntries = filtered.filter((e) =>
      olderKeys.includes(`${e.module_id}:${e.week_number}`)
    );
    const recentAvg = aggregateCompetencies(recentEntries).overall;
    const olderAvg = aggregateCompetencies(olderEntries).overall;
    if (recentAvg != null && olderAvg != null) {
      trendDelta = Math.round((recentAvg - olderAvg) * 10) / 10;
      if (trendDelta > 0.1) trend = "up";
      else if (trendDelta < -0.1) trend = "down";
      else trend = "stable";
    }
  }

  const maxPossible = maxPossibleRatings(moduleId);
  const coverageLabel = `${snap.ratingsCount} из ~${maxPossible} возможных оценок`;

  return { strongest, weakest, trend, trendDelta, coverageLabel };
}

export function buildDisciplineStats(
  fullEntries: FullDisciplineEntryRow[],
  profiles: LeagueProfile[],
  userId: string,
  groupUserIds: string[],
  moduleId?: string
): DisciplineStatRow[] {
  return SOFT_SKILLS_DISCIPLINES.map((d) => {
    const userRows = fullEntries.filter(
      (e) =>
        e.user_id === userId &&
        e.discipline === d.id &&
        (!moduleId || e.module_id === moduleId)
    );
    const groupRows = fullEntries.filter(
      (e) =>
        groupUserIds.includes(e.user_id) &&
        e.discipline === d.id &&
        (!moduleId || e.module_id === moduleId)
    );

    const wins = userRows.filter((e) => e.outcome === "win").length;
    const losses = userRows.filter((e) => e.outcome === "lose").length;
    const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null;

    const userIdx = aggregateDisciplineIndex(userRows, profiles);
    const groupScores: number[] = [];
    for (const uid of groupUserIds) {
      const idx = aggregateDisciplineIndex(
        groupRows.filter((e) => e.user_id === uid),
        profiles
      );
      if (idx.overall != null) groupScores.push(idx.overall);
    }
    groupScores.sort((a, b) => a - b);
    const groupMedian =
      groupScores.length > 0 ? groupScores[Math.floor(groupScores.length / 2)] : null;

    let detail = "";
    if (d.id === "lumo") {
      const errs = userRows.map((e) => e.error_count ?? 0);
      if (errs.length)
        detail = `Ср. ошибок: ${(errs.reduce((s, v) => s + v, 0) / errs.length).toFixed(1)}`;
    } else if (d.id === "sport") {
      const goals = userRows.map((e) => e.goals_count ?? 0);
      if (goals.length)
        detail = `Ср. голов: ${(goals.reduce((s, v) => s + v, 0) / goals.length).toFixed(1)}`;
    } else if (userIdx.entriesCount > 0) {
      detail = `${userIdx.entriesCount} записей`;
    }

    return {
      discipline: d.id,
      label: getDisciplineLabel(d.id),
      entriesCount: userIdx.entriesCount,
      winRate,
      indexScore: userIdx.byDiscipline[d.id],
      groupMedianIndex: groupMedian,
      detail,
    };
  });
}
