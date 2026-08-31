export const SOFT_SKILLS_MODULES = [
  { id: "1", label: "Модуль 1", weeks: 7 },
  { id: "2", label: "Модуль 2", weeks: 7 },
  { id: "3", label: "Модуль 3", weeks: 6 },
  { id: "4", label: "Модуль 4", weeks: 6 },
  { id: "5", label: "Модуль 5", weeks: 5 },
  { id: "6", label: "Модуль 6", weeks: 5 },
] as const;

export const SOFT_SKILLS_LEAGUES = [
  { id: "1", label: "Лига 1" },
  { id: "2", label: "Лига 2" },
  { id: "3", label: "Лига 3" },
  { id: "4", label: "Лига 4" },
] as const;

/** Placeholder team pools per league — rename later. */
export const SOFT_SKILLS_TEAMS_BY_LEAGUE: Record<
  SoftSkillsLeagueId,
  readonly { id: string; label: string }[]
> = {
  "1": [
    { id: "north", label: "Север" },
    { id: "south", label: "Юг" },
    { id: "east", label: "Восток" },
    { id: "west", label: "Запад" },
  ],
  "2": [
    { id: "lightning", label: "Молния" },
    { id: "thunder", label: "Гром" },
    { id: "whirlwind", label: "Вихрь" },
    { id: "storm", label: "Шторм" },
  ],
  "3": [
    { id: "falcon", label: "Сокол" },
    { id: "lynx", label: "Рысь" },
    { id: "puma", label: "Пума" },
    { id: "hawk", label: "Ястреб" },
  ],
  "4": [
    { id: "atlas", label: "Атлас" },
    { id: "titan", label: "Титан" },
    { id: "phoenix", label: "Феникс" },
    { id: "comet", label: "Комета" },
  ],
};

export type SoftSkillsModuleId = (typeof SOFT_SKILLS_MODULES)[number]["id"];
export type SoftSkillsLeagueId = (typeof SOFT_SKILLS_LEAGUES)[number]["id"];
export type SoftSkillsModule = (typeof SOFT_SKILLS_MODULES)[number];

export function getSoftSkillsModule(id: string): SoftSkillsModule | null {
  return SOFT_SKILLS_MODULES.find((m) => m.id === id) ?? null;
}

export function getSoftSkillsLeague(id: string) {
  return SOFT_SKILLS_LEAGUES.find((l) => l.id === id) ?? null;
}

export function getSoftSkillsTeams(leagueId: string) {
  if (leagueId in SOFT_SKILLS_TEAMS_BY_LEAGUE) {
    return SOFT_SKILLS_TEAMS_BY_LEAGUE[leagueId as SoftSkillsLeagueId];
  }
  return null;
}

export function getSoftSkillsTeam(leagueId: string, teamId: string) {
  const teams = getSoftSkillsTeams(leagueId);
  return teams?.find((t) => t.id === teamId) ?? null;
}

export function isValidModuleId(id: string): id is SoftSkillsModuleId {
  return SOFT_SKILLS_MODULES.some((m) => m.id === id);
}

export function isValidLeagueId(id: string): id is SoftSkillsLeagueId {
  return SOFT_SKILLS_LEAGUES.some((l) => l.id === id);
}
