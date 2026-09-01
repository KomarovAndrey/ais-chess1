import {
  SOFT_SKILLS_STAR_SKILLS,
  type SoftSkillsStarSkillId,
} from "@/lib/softSkillsDisciplines";
import type { SoftSkillsModuleId } from "@/lib/softSkillsModules";

export type CompetencySnapshot = {
  leadership: number | null;
  communication: number | null;
  selfReflection: number | null;
  criticalThinking: number | null;
  selfControl: number | null;
  overall: number | null;
  ratingsCount: number;
};

export type DisciplineEntryRow = {
  user_id: string;
  module_id: string;
  week_number: number;
  star_leadership: number | null;
  star_communication: number | null;
  star_self_reflection: number | null;
  star_critical_thinking: number | null;
  star_self_control: number | null;
};

const SKILL_COLUMNS: { id: SoftSkillsStarSkillId; column: keyof DisciplineEntryRow }[] = [
  { id: "leadership", column: "star_leadership" },
  { id: "communication", column: "star_communication" },
  { id: "selfReflection", column: "star_self_reflection" },
  { id: "criticalThinking", column: "star_critical_thinking" },
  { id: "selfControl", column: "star_self_control" },
];

export const EMPTY_COMPETENCY_SNAPSHOT: CompetencySnapshot = {
  leadership: null,
  communication: null,
  selfReflection: null,
  criticalThinking: null,
  selfControl: null,
  overall: null,
  ratingsCount: 0,
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function aggregateCompetencies(
  entries: DisciplineEntryRow[],
  filter?: { userId?: string; moduleId?: string }
): CompetencySnapshot {
  const filtered = entries.filter((e) => {
    if (filter?.userId && e.user_id !== filter.userId) return false;
    if (filter?.moduleId && e.module_id !== filter.moduleId) return false;
    return true;
  });

  if (filtered.length === 0) return { ...EMPTY_COMPETENCY_SNAPSHOT };

  const result: CompetencySnapshot = { ...EMPTY_COMPETENCY_SNAPSHOT };
  const skillValues: number[] = [];

  for (const { id, column } of SKILL_COLUMNS) {
    const values: number[] = [];
    for (const row of filtered) {
      const v = Number(row[column] ?? 0);
      if (v >= 1 && v <= 5) values.push(v);
    }
    if (values.length > 0) {
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      result[id] = round1(avg);
      skillValues.push(avg);
    }
  }

  result.ratingsCount = filtered.filter((row) =>
    SKILL_COLUMNS.some(({ column }) => {
      const v = Number(row[column] ?? 0);
      return v >= 1 && v <= 5;
    })
  ).length;

  if (skillValues.length > 0) {
    result.overall = round1(skillValues.reduce((s, v) => s + v, 0) / skillValues.length);
  }

  return result;
}

export function competencyToRecord(
  snapshot: CompetencySnapshot
): Record<SoftSkillsStarSkillId, number | null> {
  return {
    leadership: snapshot.leadership,
    communication: snapshot.communication,
    selfReflection: snapshot.selfReflection,
    criticalThinking: snapshot.criticalThinking,
    selfControl: snapshot.selfControl,
  };
}

export function formatCompetency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

export function overallScoreFromSnapshot(snapshot: CompetencySnapshot): number {
  return snapshot.overall ?? 0;
}

export type UserCompetencyDashboard = {
  overall: CompetencySnapshot;
  byModule: Record<SoftSkillsModuleId, CompetencySnapshot>;
};

export function buildUserCompetencyDashboard(
  entries: DisciplineEntryRow[],
  userId: string,
  moduleIds: SoftSkillsModuleId[]
): UserCompetencyDashboard {
  return {
    overall: aggregateCompetencies(entries, { userId }),
    byModule: Object.fromEntries(
      moduleIds.map((moduleId) => [moduleId, aggregateCompetencies(entries, { userId, moduleId })])
    ) as Record<SoftSkillsModuleId, CompetencySnapshot>,
  };
}

export { SOFT_SKILLS_STAR_SKILLS };
