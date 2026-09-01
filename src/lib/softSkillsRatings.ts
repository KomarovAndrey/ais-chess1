import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SoftSkillsStarSkillId } from "@/lib/softSkillsDisciplines";
import {
  aggregateCompetencies,
  buildUserCompetencyDashboard,
  competencyToRecord,
  type CompetencySnapshot,
  type DisciplineEntryRow,
  type UserCompetencyDashboard,
} from "@/lib/softSkillsCompetencies";
import {
  computeCompositeScore,
  meetsRankingThreshold,
  MIN_RATINGS_FOR_RANK,
} from "@/lib/softSkillsComposite";
import {
  aggregateDisciplineIndex,
  EMPTY_DISCIPLINE_INDEX,
  type DisciplineIndexSnapshot,
  type FullDisciplineEntryRow,
} from "@/lib/softSkillsDisciplineIndex";
import {
  buildCompetencyInsights,
  buildDisciplineStats,
  buildHeatmapData,
  buildTrendByModule,
  buildTrendByWeek,
  type CompetencyInsight,
  type DisciplineStatRow,
  type TrendPoint,
} from "@/lib/softSkillsInsights";
import {
  SOFT_SKILLS_LEAGUES,
  SOFT_SKILLS_MODULES,
  getSoftSkillsTeam,
  type SoftSkillsLeagueId,
  type SoftSkillsModuleId,
} from "@/lib/softSkillsModules";

export type SoftSkillsRatingEntry = {
  userId: string;
  username: string | null;
  displayName: string | null;
  className: string | null;
  leagueId: string | null;
  points: number;
  place: number;
  teamId?: string | null;
  teamLabel?: string | null;
  competencies?: Record<SoftSkillsStarSkillId, number | null>;
  competencyOverall?: number | null;
  disciplineIndex?: number | null;
  ratingsCount?: number;
  isProvisional?: boolean;
};

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  class_name: string | null;
  soft_skills_league_id: string | null;
};

type TeamRow = {
  user_id: string;
  module_id: string;
  league_id: string;
  team_id: string;
};

const FULL_ENTRY_SELECT =
  "user_id, module_id, week_number, discipline, outcome, result_value, error_count, time_value, team_time, personal_time, goals_count, sport_error_count, star_leadership, star_communication, star_self_reflection, star_critical_thinking, star_self_control";

async function getDb() {
  return createAdminClient() ?? (await createClient());
}

function toStarRows(full: FullDisciplineEntryRow[]): DisciplineEntryRow[] {
  return full.map((e) => ({
    user_id: e.user_id,
    module_id: e.module_id,
    week_number: e.week_number,
    star_leadership: e.star_leadership,
    star_communication: e.star_communication,
    star_self_reflection: e.star_self_reflection,
    star_critical_thinking: e.star_critical_thinking,
    star_self_control: e.star_self_control,
  }));
}

function assignPlaces(rows: Omit<SoftSkillsRatingEntry, "place">[]): SoftSkillsRatingEntry[] {
  const ranked = rows.filter((r) => !r.isProvisional && r.points > 0);
  const provisional = rows.filter((r) => r.isProvisional || r.points <= 0);

  const sorted = [...ranked].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (a.displayName || a.username || "").localeCompare(
      b.displayName || b.username || "",
      "ru"
    );
  });

  const sortedProv = [...provisional].sort((a, b) =>
    (a.displayName || a.username || "").localeCompare(b.displayName || b.username || "", "ru")
  );

  return [
    ...sorted.map((r, i) => ({ ...r, place: i + 1 })),
    ...sortedProv.map((r) => ({ ...r, place: 0 })),
  ];
}

export async function loadSoftSkillsRatingContext() {
  const db = await getDb();
  if (!db) return null;

  const { data: profiles, error: pErr } = await db
    .from("profiles")
    .select("id, username, display_name, class_name, soft_skills_league_id")
    .eq("role", "student")
    .not("username", "is", null);

  if (pErr) {
    console.error("soft skills profiles:", pErr);
    return {
      error: pErr.message,
      profiles: [] as ProfileRow[],
      disciplineEntries: [] as DisciplineEntryRow[],
      fullEntries: [] as FullDisciplineEntryRow[],
      teams: [] as TeamRow[],
    };
  }

  const { data: fullRows, error: dErr } = await db
    .from("soft_skills_discipline_entries")
    .select(FULL_ENTRY_SELECT);

  if (dErr) {
    console.error("soft skills discipline entries:", dErr);
    return {
      error: dErr.message,
      profiles: (profiles ?? []) as ProfileRow[],
      disciplineEntries: [] as DisciplineEntryRow[],
      fullEntries: [] as FullDisciplineEntryRow[],
      teams: [] as TeamRow[],
    };
  }

  const fullEntries = (fullRows ?? []) as FullDisciplineEntryRow[];
  const { data: teams } = await db
    .from("soft_skills_team_members")
    .select("user_id, module_id, league_id, team_id");

  return {
    error: null as string | null,
    profiles: (profiles ?? []) as ProfileRow[],
    disciplineEntries: toStarRows(fullEntries),
    fullEntries,
    teams: (teams ?? []) as TeamRow[],
  };
}

function userScoreData(
  starEntries: DisciplineEntryRow[],
  fullEntries: FullDisciplineEntryRow[],
  userId: string,
  moduleId?: string
) {
  const competency = aggregateCompetencies(starEntries, { userId, moduleId });
  const discipline = aggregateDisciplineIndex(fullEntries, { userId, moduleId });
  const composite = computeCompositeScore(competency.overall, discipline.overall);
  return {
    points: composite,
    competencies: competencyToRecord(competency),
    competencyOverall: competency.overall,
    disciplineIndex: discipline.overall,
    ratingsCount: competency.ratingsCount,
    isProvisional: !meetsRankingThreshold(competency.ratingsCount),
  };
}

function entryFromProfile(
  p: ProfileRow,
  starEntries: DisciplineEntryRow[],
  fullEntries: FullDisciplineEntryRow[],
  moduleId?: string,
  extra?: Partial<SoftSkillsRatingEntry>
): Omit<SoftSkillsRatingEntry, "place"> {
  const data = userScoreData(starEntries, fullEntries, p.id, moduleId);
  return {
    userId: p.id,
    username: p.username,
    displayName: p.display_name,
    className: p.class_name,
    leagueId: p.soft_skills_league_id,
    ...data,
    ...extra,
  };
}

export function buildModuleLeagueBoard(
  profiles: ProfileRow[],
  starEntries: DisciplineEntryRow[],
  fullEntries: FullDisciplineEntryRow[],
  moduleId: SoftSkillsModuleId,
  leagueId: SoftSkillsLeagueId
) {
  const rows = profiles
    .filter((p) => p.soft_skills_league_id === leagueId)
    .map((p) => entryFromProfile(p, starEntries, fullEntries, moduleId));
  return assignPlaces(rows);
}

export function buildOverallBoard(
  profiles: ProfileRow[],
  starEntries: DisciplineEntryRow[],
  fullEntries: FullDisciplineEntryRow[]
) {
  const rows = profiles
    .filter((p) => {
      if (p.soft_skills_league_id) return true;
      const { points } = userScoreData(starEntries, fullEntries, p.id);
      return points > 0;
    })
    .map((p) => entryFromProfile(p, starEntries, fullEntries));
  return assignPlaces(rows);
}

export function buildTeamBoard(
  profiles: ProfileRow[],
  starEntries: DisciplineEntryRow[],
  fullEntries: FullDisciplineEntryRow[],
  teams: TeamRow[],
  opts?: { moduleId?: SoftSkillsModuleId }
) {
  const teamByUser = new Map<string, TeamRow>();
  for (const t of teams) {
    if (opts?.moduleId && t.module_id !== opts.moduleId) continue;
    if (!teamByUser.has(t.user_id)) teamByUser.set(t.user_id, t);
  }

  const byTeam = new Map<string, Omit<SoftSkillsRatingEntry, "place">[]>();
  for (const [userId, t] of teamByUser) {
    const p = profiles.find((x) => x.id === userId);
    if (!p) continue;
    const key = `${t.league_id}:${t.team_id}`;
    const list = byTeam.get(key) ?? [];
    list.push(
      entryFromProfile(p, starEntries, fullEntries, opts?.moduleId, {
        teamId: t.team_id,
        teamLabel: getSoftSkillsTeam(t.league_id, t.team_id)?.label ?? t.team_id,
        leagueId: t.league_id,
      })
    );
    byTeam.set(key, list);
  }

  return [...byTeam.entries()]
    .map(([key, members]) => {
      const [leagueId, teamId] = key.split(":");
      const ranked = assignPlaces(members);
      const teamPoints = ranked.reduce((s, m) => s + m.points, 0);
      return {
        leagueId,
        teamId,
        teamLabel: getSoftSkillsTeam(leagueId, teamId)?.label ?? teamId,
        points: teamPoints,
        members: ranked,
      };
    })
    .sort((a, b) => b.points - a.points);
}

export function buildClassBoard(
  profiles: ProfileRow[],
  starEntries: DisciplineEntryRow[],
  fullEntries: FullDisciplineEntryRow[]
) {
  const byClass = new Map<string, Omit<SoftSkillsRatingEntry, "place">[]>();

  for (const p of profiles) {
    const cls = p.class_name?.trim();
    if (!cls) continue;
    const list = byClass.get(cls) ?? [];
    list.push(entryFromProfile(p, starEntries, fullEntries));
    byClass.set(cls, list);
  }

  return [...byClass.entries()]
    .map(([className, members]) => ({
      className,
      members: assignPlaces(members),
      points: members.reduce((s, m) => s + m.points, 0),
    }))
    .sort((a, b) => a.className.localeCompare(b.className, "ru"));
}

export type SoftSkillsUserDashboard = {
  competenciesOverall: CompetencySnapshot;
  competenciesByModule: Record<SoftSkillsModuleId, CompetencySnapshot>;
  disciplineOverall: DisciplineIndexSnapshot;
  disciplineByModule: Record<SoftSkillsModuleId, DisciplineIndexSnapshot>;
  compositeOverall: number;
  compositeByModule: Record<SoftSkillsModuleId, number>;
  insights: CompetencyInsight;
  insightsByModule: Record<SoftSkillsModuleId, CompetencyInsight>;
  trendByWeek: TrendPoint[];
  trendByModule: TrendPoint[];
  trendByWeekByModule: Record<SoftSkillsModuleId, TrendPoint[]>;
  heatmap: ReturnType<typeof buildHeatmapData>;
  disciplineStats: DisciplineStatRow[];
  isProvisional: boolean;
};

export type SoftSkillsPlacesResult = {
  error: string | null;
  leaguePlace: number | null;
  classPlace: number | null;
  teamPlace: number | null;
  overallPlace: number | null;
  overallPoints: number;
  leagueId: string | null;
  className: string | null;
  teamLabel: string | null;
  competenciesOverall: CompetencySnapshot;
  competenciesByModule: Record<SoftSkillsModuleId, CompetencySnapshot>;
  disciplineOverall: DisciplineIndexSnapshot;
  compositeOverall: number;
  isProvisional: boolean;
  dashboard: SoftSkillsUserDashboard | null;
};

function buildUserDashboard(
  starEntries: DisciplineEntryRow[],
  fullEntries: FullDisciplineEntryRow[],
  userId: string,
  groupUserIds: string[]
): SoftSkillsUserDashboard {
  const moduleIds = SOFT_SKILLS_MODULES.map((m) => m.id);
  const competencyDash = buildUserCompetencyDashboard(starEntries, userId, moduleIds);

  const disciplineOverall = aggregateDisciplineIndex(fullEntries, { userId });
  const disciplineByModule = Object.fromEntries(
    moduleIds.map((id) => [id, aggregateDisciplineIndex(fullEntries, { userId, moduleId: id })])
  ) as Record<SoftSkillsModuleId, DisciplineIndexSnapshot>;

  const compositeOverall = computeCompositeScore(
    competencyDash.overall.overall,
    disciplineOverall.overall
  );
  const compositeByModule = Object.fromEntries(
    moduleIds.map((id) => [
      id,
      computeCompositeScore(
        competencyDash.byModule[id].overall,
        disciplineByModule[id].overall
      ),
    ])
  ) as Record<SoftSkillsModuleId, number>;

  return {
    competenciesOverall: competencyDash.overall,
    competenciesByModule: competencyDash.byModule,
    disciplineOverall,
    disciplineByModule,
    compositeOverall,
    compositeByModule,
    insights: buildCompetencyInsights(starEntries, userId),
    insightsByModule: Object.fromEntries(
      moduleIds.map((id) => [id, buildCompetencyInsights(starEntries, userId, id)])
    ) as Record<SoftSkillsModuleId, CompetencyInsight>,
    trendByWeek: buildTrendByWeek(starEntries, fullEntries, userId),
    trendByModule: buildTrendByModule(starEntries, fullEntries, userId),
    trendByWeekByModule: Object.fromEntries(
      moduleIds.map((id) => [
        id,
        buildTrendByWeek(starEntries, fullEntries, userId, id),
      ])
    ) as Record<SoftSkillsModuleId, TrendPoint[]>,
    heatmap: buildHeatmapData(starEntries, userId),
    disciplineStats: buildDisciplineStats(fullEntries, userId, groupUserIds),
    isProvisional: !meetsRankingThreshold(competencyDash.overall.ratingsCount),
  };
}

function groupUserIdsForUser(
  profiles: ProfileRow[],
  userId: string
): string[] {
  const me = profiles.find((p) => p.id === userId);
  if (me?.soft_skills_league_id) {
    return profiles
      .filter((p) => p.soft_skills_league_id === me.soft_skills_league_id)
      .map((p) => p.id);
  }
  if (me?.class_name?.trim()) {
    return profiles
      .filter((p) => p.class_name?.trim() === me.class_name?.trim())
      .map((p) => p.id);
  }
  return profiles.map((p) => p.id);
}

export async function getSoftSkillsPlacesForUser(userId: string): Promise<SoftSkillsPlacesResult> {
  const moduleIds = SOFT_SKILLS_MODULES.map((m) => m.id);
  const emptyComp = buildUserCompetencyDashboard([], userId, moduleIds);

  const ctx = await loadSoftSkillsRatingContext();
  if (!ctx || ctx.error) {
    return {
      error: ctx?.error ?? "no_db",
      leaguePlace: null,
      classPlace: null,
      teamPlace: null,
      overallPlace: null,
      overallPoints: 0,
      leagueId: null,
      className: null,
      teamLabel: null,
      competenciesOverall: emptyComp.overall,
      competenciesByModule: emptyComp.byModule,
      disciplineOverall: EMPTY_DISCIPLINE_INDEX,
      compositeOverall: 0,
      isProvisional: true,
      dashboard: null,
    };
  }

  const groupIds = groupUserIdsForUser(ctx.profiles, userId);
  const dashboard = buildUserDashboard(
    ctx.disciplineEntries,
    ctx.fullEntries,
    userId,
    groupIds
  );

  const me = ctx.profiles.find((p) => p.id === userId);
  const overall = buildOverallBoard(ctx.profiles, ctx.disciplineEntries, ctx.fullEntries);
  const meOverall = overall.find((r) => r.userId === userId);

  let leaguePlace: number | null = null;
  if (me?.soft_skills_league_id) {
    const leagueBoard = assignPlaces(
      ctx.profiles
        .filter((p) => p.soft_skills_league_id === me.soft_skills_league_id)
        .map((p) => entryFromProfile(p, ctx.disciplineEntries, ctx.fullEntries))
    );
    leaguePlace = leagueBoard.find((r) => r.userId === userId)?.place ?? null;
    if (leaguePlace === 0) leaguePlace = null;
  }

  let classPlace: number | null = null;
  if (me?.class_name?.trim()) {
    const cls = buildClassBoard(ctx.profiles, ctx.disciplineEntries, ctx.fullEntries).find(
      (c) => c.className === me.class_name?.trim()
    );
    classPlace = cls?.members.find((m) => m.userId === userId)?.place ?? null;
    if (classPlace === 0) classPlace = null;
  }

  let teamPlace: number | null = null;
  let teamLabel: string | null = null;
  const myTeam = ctx.teams.find((t) => t.user_id === userId);
  if (myTeam) {
    teamLabel = getSoftSkillsTeam(myTeam.league_id, myTeam.team_id)?.label ?? myTeam.team_id;
    const teamBoards = buildTeamBoard(
      ctx.profiles,
      ctx.disciplineEntries,
      ctx.fullEntries,
      ctx.teams,
      { moduleId: myTeam.module_id as SoftSkillsModuleId }
    );
    const board = teamBoards.find(
      (t) => t.leagueId === myTeam.league_id && t.teamId === myTeam.team_id
    );
    teamPlace = board?.members.find((m) => m.userId === userId)?.place ?? null;
    if (teamPlace === 0) teamPlace = null;
  }

  const overallPlace = meOverall?.place && meOverall.place > 0 ? meOverall.place : null;

  return {
    error: null,
    leaguePlace,
    classPlace,
    teamPlace,
    overallPlace,
    overallPoints: dashboard.compositeOverall,
    leagueId: me?.soft_skills_league_id ?? null,
    className: me?.class_name ?? null,
    teamLabel,
    competenciesOverall: dashboard.competenciesOverall,
    competenciesByModule: dashboard.competenciesByModule,
    disciplineOverall: dashboard.disciplineOverall,
    compositeOverall: dashboard.compositeOverall,
    isProvisional: dashboard.isProvisional,
    dashboard,
  };
}

export { MIN_RATINGS_FOR_RANK };
export type { UserCompetencyDashboard, CompetencySnapshot, FullDisciplineEntryRow };
