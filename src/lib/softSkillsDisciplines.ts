export const SOFT_SKILLS_DISCIPLINES = [
  { id: "lumo", label: "Lumo" },
  { id: "robo", label: "Robo" },
  { id: "sport", label: "Sport" },
  { id: "3d", label: "3D" },
] as const;

export type SoftSkillsDisciplineId = (typeof SOFT_SKILLS_DISCIPLINES)[number]["id"];

export const SOFT_SKILLS_STAR_SKILLS = [
  { id: "leadership", label: "Лидерство" },
  { id: "communication", label: "Коммуникация" },
  { id: "selfReflection", label: "Саморефлексия" },
  { id: "criticalThinking", label: "Критическое мышление" },
  { id: "selfControl", label: "Самоконтроль" },
] as const;

export type SoftSkillsStarSkillId = (typeof SOFT_SKILLS_STAR_SKILLS)[number]["id"];

export type SoftSkillsOutcome = "win" | "lose" | null;

export type SoftSkillsDisciplineEntry = {
  discipline: SoftSkillsDisciplineId;
  outcome: SoftSkillsOutcome;
  resultValue: string;
  errorCount: number;
  timeValue: string;
  teamTime: string;
  personalTime: string;
  goalsCount: number;
  sportErrorCount: number;
  stars: Record<SoftSkillsStarSkillId, number>;
  updatedAt: string | null;
};

export const EMPTY_DISCIPLINE_ENTRY: Omit<SoftSkillsDisciplineEntry, "discipline"> = {
  outcome: null,
  resultValue: "",
  errorCount: 0,
  timeValue: "",
  teamTime: "",
  personalTime: "",
  goalsCount: 0,
  sportErrorCount: 0,
  stars: {
    leadership: 0,
    communication: 0,
    selfReflection: 0,
    criticalThinking: 0,
    selfControl: 0,
  },
  updatedAt: null,
};

export function disciplinesForLeague(leagueId: string): SoftSkillsDisciplineId[] {
  if (leagueId === "1" || leagueId === "2" || leagueId === "3") {
    return ["lumo", "robo", "sport", "3d"];
  }
  return [];
}

export function isValidDisciplineId(id: string): id is SoftSkillsDisciplineId {
  return SOFT_SKILLS_DISCIPLINES.some((d) => d.id === id);
}

export function getDisciplineLabel(id: SoftSkillsDisciplineId): string {
  return SOFT_SKILLS_DISCIPLINES.find((d) => d.id === id)?.label ?? id;
}

export function emptyEntryFor(discipline: SoftSkillsDisciplineId): SoftSkillsDisciplineEntry {
  return { discipline, ...EMPTY_DISCIPLINE_ENTRY, stars: { ...EMPTY_DISCIPLINE_ENTRY.stars } };
}
