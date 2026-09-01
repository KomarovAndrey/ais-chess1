import type { SoftSkillsDisciplineEntry, SoftSkillsStarSkillId } from "@/lib/softSkillsDisciplines";
import { emptyEntryFor, type SoftSkillsDisciplineId } from "@/lib/softSkillsDisciplines";

type DbRow = {
  discipline: string;
  outcome: string | null;
  result_value: string | null;
  error_count: number | null;
  time_value: string | null;
  team_time: string | null;
  personal_time: string | null;
  goals_count: number | null;
  sport_error_count: number | null;
  star_leadership: number | null;
  star_communication: number | null;
  star_self_reflection: number | null;
  star_critical_thinking: number | null;
  star_self_control: number | null;
  updated_at: string | null;
};

export function rowToEntry(row: DbRow): SoftSkillsDisciplineEntry {
  const discipline = row.discipline as SoftSkillsDisciplineId;
  return {
    discipline,
    outcome: row.outcome === "win" || row.outcome === "lose" ? row.outcome : null,
    resultValue: row.result_value ?? "",
    errorCount: row.error_count ?? 0,
    timeValue: row.time_value ?? "",
    teamTime: row.team_time ?? "",
    personalTime: row.personal_time ?? "",
    goalsCount: row.goals_count ?? 0,
    sportErrorCount: row.sport_error_count ?? 0,
    stars: {
      leadership: row.star_leadership ?? 0,
      communication: row.star_communication ?? 0,
      selfReflection: row.star_self_reflection ?? 0,
      criticalThinking: row.star_critical_thinking ?? 0,
      selfControl: row.star_self_control ?? 0,
    },
    updatedAt: row.updated_at ?? null,
  };
}

export function entryToDbPayload(
  entry: SoftSkillsDisciplineEntry,
  userId: string,
  moduleId: string,
  weekNumber: number,
  updatedBy: string
) {
  return {
    user_id: userId,
    module_id: moduleId,
    week_number: weekNumber,
    discipline: entry.discipline,
    outcome: entry.outcome,
    result_value: entry.resultValue.trim() || null,
    error_count: entry.errorCount,
    time_value: entry.timeValue.trim() || null,
    team_time: entry.teamTime.trim() || null,
    personal_time: entry.personalTime.trim() || null,
    goals_count: entry.goalsCount,
    sport_error_count: entry.sportErrorCount,
    star_leadership: entry.stars.leadership,
    star_communication: entry.stars.communication,
    star_self_reflection: entry.stars.selfReflection,
    star_critical_thinking: entry.stars.criticalThinking,
    star_self_control: entry.stars.selfControl,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  };
}

export function entriesMapFromRows(
  rows: DbRow[],
  disciplines: SoftSkillsDisciplineId[]
): Record<SoftSkillsDisciplineId, SoftSkillsDisciplineEntry> {
  const map = Object.fromEntries(
    disciplines.map((d) => [d, emptyEntryFor(d)])
  ) as Record<SoftSkillsDisciplineId, SoftSkillsDisciplineEntry>;

  for (const row of rows) {
    if (disciplines.includes(row.discipline as SoftSkillsDisciplineId)) {
      map[row.discipline as SoftSkillsDisciplineId] = rowToEntry(row);
    }
  }

  return map;
}

export function clampStar(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(5, Math.round(value)));
}

export function sanitizeStars(stars: Partial<Record<SoftSkillsStarSkillId, number>>) {
  return {
    leadership: clampStar(stars.leadership ?? 0),
    communication: clampStar(stars.communication ?? 0),
    selfReflection: clampStar(stars.selfReflection ?? 0),
    criticalThinking: clampStar(stars.criticalThinking ?? 0),
    selfControl: clampStar(stars.selfControl ?? 0),
  };
}
