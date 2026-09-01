import { SOFT_SKILLS_MODULES } from "@/lib/softSkillsModules";

export function maxPossibleRatings(moduleId?: string): number {
  if (moduleId) {
    const mod = SOFT_SKILLS_MODULES.find((m) => m.id === moduleId);
    return (mod?.weeks ?? 0) * 4;
  }
  return SOFT_SKILLS_MODULES.reduce((sum, m) => sum + m.weeks * 4, 0);
}
