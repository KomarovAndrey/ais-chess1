import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SoftSkillsStarSkillId } from "@/lib/softSkillsDisciplines";
import {
  aggregateCompetencies,
  buildUserCompetencyDashboard,
  competencyToRecord,
  overallScoreFromSnapshot,
  type CompetencySnapshot,
  type DisciplineEntryRow,
  type UserCompetencyDashboard,
} from "@/lib/softSkillsCompetencies";
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

async function getDb() {
  return createAdminClient() ?? (await createClient());
}

function assignPlaces(rows: Omit<SoftSkillsRatingEntry, "place">[]): SoftSkillsRatingEntry[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (a.displayName || a.username || "").localeCompare(
      b.displayName || b.username || "",
      "ru"
    );
  });
  return sorted.map((r, i) => ({ ...r, place: i + 1 }));
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
      teams: [] as TeamRow[],
    };
  }

  const { data: disciplineEntries, error: dErr } = await db
    .from("soft_skills_discipline_entries")
    .select(
      "user_id, module_id, week_number, star_leadership, star_communication, star_self_reflection, star_critical_thinking, star_self_control"
    );

  if (dErr) {
    console.error("soft skills discipline entries:", dErr);
    return {
      error: dErr.message,
      profiles: (profiles ?? []) as ProfileRow[],
      disciplineEntries: [] as DisciplineEntryRow[],
      teams: [] as TeamRow[],
    };
  }

  const { data: teams } = await db
    .from("soft_skills_team_members")
    .select("user_id, module_id, league_id, team_id");

  return {
    error: null as string | null,
    profiles: (profiles ?? []) as ProfileRow[],
    disciplineEntries: (disciplineEntries ?? []) as DisciplineEntryRow[],
    teams: (teams ?? []) as TeamRow[],
  };
}

function userCompetencyData(
  entries: DisciplineEntryRow[],
  userId: string,
  moduleId?: string
) {
  const snapshot = aggregateCompetencies(entries, { userId, moduleId });
  return {
    points: overallScoreFromSnapshot(snapshot),
    competencies: competencyToRecord(snapshot),
  };
}

function entryFromProfile(
  p: ProfileRow,
  entries: DisciplineEntryRow[],
  moduleId?: string,
  extra?: Partial<SoftSkillsRatingEntry>
): Omit<SoftSkillsRatingEntry, "place"> {
  const { points, competencies } = userCompetencyData(entries, p.id, moduleId);
  return {
    userId: p.id,
    username: p.username,
    displayName: p.display_name,
    className: p.class_name,
    leagueId: p.soft_skills_league_id,
    points,
    competencies,
    ...extra,
  };
}

/** League board for one module (children of that league). */
export function buildModuleLeagueBoard(
  profiles: ProfileRow[],
  entries: DisciplineEntryRow[],
  moduleId: SoftSkillsModuleId,
  leagueId: SoftSkillsLeagueId
) {
  const rows = profiles
    .filter((p) => p.soft_skills_league_id === leagueId)
    .map((p) => entryFromProfile(p, entries, moduleId));
  return assignPlaces(rows);
}

/** Overall: average competencies across all modules for the year. */
export function buildOverallBoard(profiles: ProfileRow[], entries: DisciplineEntryRow[]) {
  const rows = profiles
    .filter((p) => {
      if (p.soft_skills_league_id) return true;
      const { points } = userCompetencyData(entries, p.id);
      return points > 0;
    })
    .map((p) => entryFromProfile(p, entries));
  return assignPlaces(rows);
}

/** Team board (overall competency among kids in teams). */
export function buildTeamBoard(
  profiles: ProfileRow[],
  entries: DisciplineEntryRow[],
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
      entryFromProfile(p, entries, opts?.moduleId, {
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

/** Class board (overall competency). */
export function buildClassBoard(profiles: ProfileRow[], entries: DisciplineEntryRow[]) {
  const byClass = new Map<string, Omit<SoftSkillsRatingEntry, "place">[]>();

  for (const p of profiles) {
    const cls = p.class_name?.trim();
    if (!cls) continue;
    const list = byClass.get(cls) ?? [];
    list.push(entryFromProfile(p, entries));
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
};

export async function getSoftSkillsPlacesForUser(userId: string): Promise<SoftSkillsPlacesResult> {
  const emptyDashboard = buildUserCompetencyDashboard(
    [],
    userId,
    SOFT_SKILLS_MODULES.map((m) => m.id)
  );

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
      competenciesOverall: emptyDashboard.overall,
      competenciesByModule: emptyDashboard.byModule,
    };
  }

  const dashboard = buildUserCompetencyDashboard(
    ctx.disciplineEntries,
    userId,
    SOFT_SKILLS_MODULES.map((m) => m.id)
  );

  const me = ctx.profiles.find((p) => p.id === userId);
  const overall = buildOverallBoard(ctx.profiles, ctx.disciplineEntries);
  const meOverall = overall.find((r) => r.userId === userId);

  let leaguePlace: number | null = null;
  if (me?.soft_skills_league_id) {
    const leagueBoard = assignPlaces(
      ctx.profiles
        .filter((p) => p.soft_skills_league_id === me.soft_skills_league_id)
        .map((p) => entryFromProfile(p, ctx.disciplineEntries))
    );
    leaguePlace = leagueBoard.find((r) => r.userId === userId)?.place ?? null;
  }

  let classPlace: number | null = null;
  if (me?.class_name?.trim()) {
    const cls = buildClassBoard(ctx.profiles, ctx.disciplineEntries).find(
      (c) => c.className === me.class_name?.trim()
    );
    classPlace = cls?.members.find((m) => m.userId === userId)?.place ?? null;
  }

  let teamPlace: number | null = null;
  let teamLabel: string | null = null;
  const myTeam = ctx.teams.find((t) => t.user_id === userId);
  if (myTeam) {
    teamLabel = getSoftSkillsTeam(myTeam.league_id, myTeam.team_id)?.label ?? myTeam.team_id;
    const teamBoards = buildTeamBoard(ctx.profiles, ctx.disciplineEntries, ctx.teams, {
      moduleId: myTeam.module_id as SoftSkillsModuleId,
    });
    const board = teamBoards.find(
      (t) => t.leagueId === myTeam.league_id && t.teamId === myTeam.team_id
    );
    teamPlace = board?.members.find((m) => m.userId === userId)?.place ?? null;
  }

  return {
    error: null,
    leaguePlace,
    classPlace,
    teamPlace,
    overallPlace: meOverall?.place ?? null,
    overallPoints: meOverall?.points ?? 0,
    leagueId: me?.soft_skills_league_id ?? null,
    className: me?.class_name ?? null,
    teamLabel,
    competenciesOverall: dashboard.overall,
    competenciesByModule: dashboard.byModule,
  };
}

export type { UserCompetencyDashboard, CompetencySnapshot };
