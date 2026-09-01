import { aggregateCompetencies } from "@/lib/softSkillsCompetencies";
import { SOFT_SKILLS_STAR_SKILLS } from "@/lib/softSkillsDisciplines";
import { SOFT_SKILLS_MODULES } from "@/lib/softSkillsModules";
import type { FullDisciplineEntryRow } from "@/lib/softSkillsDisciplineIndex";
import type { DisciplineEntryRow } from "@/lib/softSkillsCompetencies";

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  class_name: string | null;
  soft_skills_league_id: string | null;
};

export type ClassCompetencyHeatmap = {
  className: string;
  skills: { id: string; label: string }[];
  averages: (number | null)[];
  studentCount: number;
};

export type WeekCompletionRow = {
  userId: string;
  displayName: string;
  className: string | null;
  leagueId: string | null;
  ratedDisciplines: number;
  expectedDisciplines: number;
  complete: boolean;
};

export function buildClassHeatmaps(
  profiles: ProfileRow[],
  starEntries: DisciplineEntryRow[]
): ClassCompetencyHeatmap[] {
  const classes = [
    ...new Set(profiles.map((p) => p.class_name?.trim()).filter(Boolean)),
  ] as string[];

  return classes.map((className) => {
    const students = profiles.filter((p) => p.class_name?.trim() === className);
    const averages = SOFT_SKILLS_STAR_SKILLS.map((skill) => {
      const values: number[] = [];
      for (const s of students) {
        const snap = aggregateCompetencies(starEntries, { userId: s.id });
        const v = snap[skill.id];
        if (v != null) values.push(v);
      }
      if (values.length === 0) return null;
      return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
    });

    return {
      className,
      skills: SOFT_SKILLS_STAR_SKILLS.map((s) => ({ id: s.id, label: s.label })),
      averages,
      studentCount: students.length,
    };
  });
}

export function buildWeekCompletion(
  profiles: ProfileRow[],
  fullEntries: FullDisciplineEntryRow[],
  moduleId: string,
  weekNumber: number
): WeekCompletionRow[] {
  const expected = 4;

  return profiles
    .filter((p) => p.soft_skills_league_id)
    .map((p) => {
      const rows = fullEntries.filter(
        (e) =>
          e.user_id === p.id &&
          e.module_id === moduleId &&
          e.week_number === weekNumber
      );
      const rated = rows.filter((e) => {
        const hasStars =
          (e.star_leadership ?? 0) >= 1 ||
          (e.star_communication ?? 0) >= 1 ||
          (e.star_self_reflection ?? 0) >= 1 ||
          (e.star_critical_thinking ?? 0) >= 1 ||
          (e.star_self_control ?? 0) >= 1;
        const hasDiscipline =
          e.outcome != null ||
          Boolean(e.result_value?.trim()) ||
          Boolean(e.time_value?.trim()) ||
          Boolean(e.personal_time?.trim()) ||
          Boolean(e.team_time?.trim()) ||
          (e.goals_count ?? 0) > 0;
        return hasStars || hasDiscipline;
      }).length;

      return {
        userId: p.id,
        displayName: p.display_name?.trim() || p.username || "Ученик",
        className: p.class_name,
        leagueId: p.soft_skills_league_id,
        ratedDisciplines: rated,
        expectedDisciplines: expected,
        complete: rated >= expected,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "ru"));
}

export function buildModuleComparison(
  profiles: ProfileRow[],
  starEntries: DisciplineEntryRow[]
) {
  return SOFT_SKILLS_MODULES.map((m) => {
    const values: number[] = [];
    for (const p of profiles) {
      const snap = aggregateCompetencies(starEntries, { userId: p.id, moduleId: m.id });
      if (snap.overall != null) values.push(snap.overall);
    }
    const avg =
      values.length > 0
        ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
        : null;
    return { moduleId: m.id, label: m.label, average: avg, studentsWithData: values.length };
  });
}

export function analyticsToCsv(
  classHeatmaps: ClassCompetencyHeatmap[],
  moduleComparison: ReturnType<typeof buildModuleComparison>
): string {
  const lines: string[] = [];
  lines.push("Класс,Учеников," + SOFT_SKILLS_STAR_SKILLS.map((s) => s.label).join(","));
  for (const c of classHeatmaps) {
    lines.push(
      `${c.className},${c.studentCount},${c.averages.map((a) => (a != null ? a : "")).join(",")}`
    );
  }
  lines.push("");
  lines.push("Модуль,Среднее,Учеников с данными");
  for (const m of moduleComparison) {
    lines.push(`${m.label},${m.average ?? ""},${m.studentsWithData}`);
  }
  return lines.join("\n");
}
