export const SOFT_SKILLS_MODULES = [
  { id: "1", label: "Модуль 1" },
  { id: "2", label: "Модуль 2" },
  { id: "3", label: "Модуль 3" },
  { id: "4", label: "Модуль 4" },
  { id: "5", label: "Модуль 5" },
  { id: "6", label: "Модуль 6" },
] as const;

export type SoftSkillsModuleId = (typeof SOFT_SKILLS_MODULES)[number]["id"];

export function getSoftSkillsModule(id: string) {
  return SOFT_SKILLS_MODULES.find((m) => m.id === id) ?? null;
}
