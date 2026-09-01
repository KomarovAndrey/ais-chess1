import type { SoftSkillsDashboardView, SoftSkillsPlacesView } from "@/components/soft-skills/SoftSkillsProfileSection";

export function mapSoftSkillsApiResponse(data: Record<string, unknown>): {
  softPlaces: SoftSkillsPlacesView;
  competencyDashboard: SoftSkillsDashboardView;
} {
  const dashboard = data.dashboard as Record<string, unknown> | null | undefined;

  const softPlaces: SoftSkillsPlacesView = {
    leaguePlace: (data.leaguePlace as number | null) ?? null,
    classPlace: (data.classPlace as number | null) ?? null,
    teamPlace: (data.teamPlace as number | null) ?? null,
    overallPlace: (data.overallPlace as number | null) ?? null,
    overallPoints: (data.overallPoints as number) ?? 0,
    leagueLabel: (data.leagueLabel as string | null) ?? null,
    className: (data.className as string | null) ?? null,
    teamLabel: (data.teamLabel as string | null) ?? null,
    isProvisional: (data.isProvisional as boolean) ?? false,
    compositeOverall: (data.compositeOverall as number) ?? 0,
    compositeIsPartial: (dashboard?.compositeIsPartial as boolean) ?? false,
    disciplineOverall: (data.disciplineOverall as { overall?: number | null })?.overall ?? null,
    competencyOverall: (data.competenciesOverall as { overall?: number | null })?.overall ?? null,
  };

  const competencyDashboard: SoftSkillsDashboardView = dashboard
    ? {
        overall: dashboard.competenciesOverall as SoftSkillsDashboardView["overall"],
        byModule: (dashboard.competenciesByModule as SoftSkillsDashboardView["byModule"]) ?? {},
        disciplineOverall: dashboard.disciplineOverall as SoftSkillsDashboardView["disciplineOverall"],
        disciplineByModule:
          dashboard.disciplineByModule as SoftSkillsDashboardView["disciplineByModule"],
        compositeOverall: dashboard.compositeOverall as number,
        compositeIsPartial: dashboard.compositeIsPartial as boolean,
        compositeByModule: dashboard.compositeByModule as SoftSkillsDashboardView["compositeByModule"],
        compositeIsPartialByModule:
          dashboard.compositeIsPartialByModule as SoftSkillsDashboardView["compositeIsPartialByModule"],
        insights: dashboard.insights as SoftSkillsDashboardView["insights"],
        insightsByModule: dashboard.insightsByModule as SoftSkillsDashboardView["insightsByModule"],
        trendByWeek: dashboard.trendByWeek as SoftSkillsDashboardView["trendByWeek"],
        trendByWeekByModule:
          dashboard.trendByWeekByModule as SoftSkillsDashboardView["trendByWeekByModule"],
        trendByModule: dashboard.trendByModule as SoftSkillsDashboardView["trendByModule"],
        heatmap: dashboard.heatmap as SoftSkillsDashboardView["heatmap"],
        disciplineStats: dashboard.disciplineStats as SoftSkillsDashboardView["disciplineStats"],
        disciplineStatsByModule:
          dashboard.disciplineStatsByModule as SoftSkillsDashboardView["disciplineStatsByModule"],
        isProvisional: dashboard.isProvisional as boolean,
      }
    : {
        overall: (data.competenciesOverall as SoftSkillsDashboardView["overall"]) ?? {
          leadership: null,
          communication: null,
          selfReflection: null,
          criticalThinking: null,
          selfControl: null,
          overall: null,
          ratingsCount: 0,
        },
        byModule: (data.competenciesByModule as SoftSkillsDashboardView["byModule"]) ?? {},
      };

  return { softPlaces, competencyDashboard };
}
