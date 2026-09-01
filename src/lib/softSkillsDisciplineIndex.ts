import type { SoftSkillsDisciplineId } from "@/lib/softSkillsDisciplines";
import { SOFT_SKILLS_DISCIPLINES } from "@/lib/softSkillsDisciplines";

export type FullDisciplineEntryRow = {
  user_id: string;
  module_id: string;
  week_number: number;
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
};

export type DisciplineIndexSnapshot = {
  overall: number | null;
  entriesCount: number;
  byDiscipline: Record<SoftSkillsDisciplineId, number | null>;
};

export const EMPTY_DISCIPLINE_INDEX: DisciplineIndexSnapshot = {
  overall: null,
  entriesCount: 0,
  byDiscipline: Object.fromEntries(
    SOFT_SKILLS_DISCIPLINES.map((d) => [d.id, null])
  ) as Record<SoftSkillsDisciplineId, number | null>,
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Parse "90", "1:30", "1:30.5" → seconds. */
export function parseTimeToSeconds(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const s = raw.trim().replace(",", ".");
  if (s.includes(":")) {
    const [m, sec] = s.split(":");
    const minutes = Number(m);
    const seconds = Number(sec);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return minutes * 60 + seconds;
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function outcomeScore(outcome: string | null): number | null {
  if (outcome === "win") return 5;
  if (outcome === "lose") return 1;
  return null;
}

function timeRelativeScore(seconds: number, cohortSeconds: number[]): number {
  const valid = cohortSeconds.filter((v) => v > 0);
  if (valid.length === 0) return 3;
  const med = median(valid);
  if (med <= 0) return 3;
  const ratio = med / seconds;
  return clamp(1 + ratio * 2, 1, 5);
}

function errorScore(errors: number, maxErrors = 10): number {
  return clamp(5 - (errors / maxErrors) * 4, 1, 5);
}

function numericRelativeScore(value: number, cohortValues: number[]): number {
  const valid = cohortValues.filter((v) => v > 0);
  if (valid.length === 0) return 3;
  const max = Math.max(...valid);
  if (max <= 0) return 3;
  return clamp(1 + (value / max) * 4, 1, 5);
}

function cohortForEntry(
  all: FullDisciplineEntryRow[],
  entry: FullDisciplineEntryRow
): FullDisciplineEntryRow[] {
  return all.filter(
    (e) =>
      e.module_id === entry.module_id &&
      e.week_number === entry.week_number &&
      e.discipline === entry.discipline
  );
}

function scoreSingleEntry(
  entry: FullDisciplineEntryRow,
  cohort: FullDisciplineEntryRow[]
): number | null {
  const parts: number[] = [];
  const outcome = outcomeScore(entry.outcome);
  if (outcome != null) parts.push(outcome);

  const discipline = entry.discipline as SoftSkillsDisciplineId;

  if (discipline === "lumo") {
    const results = cohort
      .map((e) => Number(e.result_value))
      .filter((n) => Number.isFinite(n) && n > 0);
    const val = Number(entry.result_value);
    if (Number.isFinite(val) && val > 0) parts.push(numericRelativeScore(val, results));
    parts.push(errorScore(entry.error_count ?? 0));
  } else if (discipline === "robo") {
    const times = cohort
      .map((e) => parseTimeToSeconds(e.time_value))
      .filter((t): t is number => t != null);
    const t = parseTimeToSeconds(entry.time_value);
    if (t != null) parts.push(timeRelativeScore(t, times));
  } else if (discipline === "3d") {
    const times = cohort
      .map((e) => parseTimeToSeconds(e.personal_time) ?? parseTimeToSeconds(e.team_time))
      .filter((t): t is number => t != null);
    const t = parseTimeToSeconds(entry.personal_time) ?? parseTimeToSeconds(entry.team_time);
    if (t != null) parts.push(timeRelativeScore(t, times));
  } else if (discipline === "sport") {
    const goals = cohort.map((e) => e.goals_count ?? 0);
    parts.push(numericRelativeScore(entry.goals_count ?? 0, goals));
    parts.push(errorScore(entry.sport_error_count ?? 0));
  }

  if (parts.length === 0) return null;
  return parts.reduce((s, v) => s + v, 0) / parts.length;
}

export function aggregateDisciplineIndex(
  entries: FullDisciplineEntryRow[],
  filter?: { userId?: string; moduleId?: string }
): DisciplineIndexSnapshot {
  const filtered = entries.filter((e) => {
    if (filter?.userId && e.user_id !== filter.userId) return false;
    if (filter?.moduleId && e.module_id !== filter.moduleId) return false;
    return true;
  });

  if (filtered.length === 0) return { ...EMPTY_DISCIPLINE_INDEX };

  const entryScores: { discipline: SoftSkillsDisciplineId; score: number }[] = [];

  for (const entry of filtered) {
    const score = scoreSingleEntry(entry, cohortForEntry(entries, entry));
    if (score != null) {
      entryScores.push({ discipline: entry.discipline as SoftSkillsDisciplineId, score });
    }
  }

  const byDiscipline = { ...EMPTY_DISCIPLINE_INDEX.byDiscipline };
  for (const d of SOFT_SKILLS_DISCIPLINES) {
    const scores = entryScores.filter((x) => x.discipline === d.id).map((x) => x.score);
    if (scores.length > 0) {
      byDiscipline[d.id] = round1(scores.reduce((s, v) => s + v, 0) / scores.length);
    }
  }

  const allScores = entryScores.map((x) => x.score);
  return {
    overall:
      allScores.length > 0
        ? round1(allScores.reduce((s, v) => s + v, 0) / allScores.length)
        : null,
    entriesCount: entryScores.length,
    byDiscipline,
  };
}
