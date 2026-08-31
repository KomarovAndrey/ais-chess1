import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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
};

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  class_name: string | null;
  soft_skills_league_id: string | null;
};

type ScoreRow = {
  user_id: string;
  module_id: string;
  points: number | string;
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

function toNumber(v: number | string | null | undefined) {
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  return Number.isFinite(n) ? n : 0;
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
    return { error: pErr.message, profiles: [] as ProfileRow[], scores: [] as ScoreRow[], teams: [] as TeamRow[] };
  }

  const { data: scores, error: sErr } = await db
    .from("soft_skills_scores")
    .select("user_id, module_id, points");

  if (sErr) {
    console.error("soft skills scores:", sErr);
    return {
      error: sErr.message,
      profiles: (profiles ?? []) as ProfileRow[],
      scores: [] as ScoreRow[],
      teams: [] as TeamRow[],
    };
  }

  const { data: teams } = await db
    .from("soft_skills_team_members")
    .select("user_id, module_id, league_id, team_id");

  return {
    error: null as string | null,
    profiles: (profiles ?? []) as ProfileRow[],
    scores: (scores ?? []) as ScoreRow[],
    teams: (teams ?? []) as TeamRow[],
  };
}

function sumPoints(
  scores: ScoreRow[],
  filter?: { userId?: string; moduleId?: string }
) {
  const map = new Map<string, number>();
  for (const s of scores) {
    if (filter?.userId && s.user_id !== filter.userId) continue;
    if (filter?.moduleId && s.module_id !== filter.moduleId) continue;
    map.set(s.user_id, (map.get(s.user_id) ?? 0) + toNumber(s.points));
  }
  return map;
}

function entryFromProfile(
  p: ProfileRow,
  points: number,
  extra?: Partial<SoftSkillsRatingEntry>
): Omit<SoftSkillsRatingEntry, "place"> {
  return {
    userId: p.id,
    username: p.username,
    displayName: p.display_name,
    className: p.class_name,
    leagueId: p.soft_skills_league_id,
    points,
    ...extra,
  };
}

/** League board for one module (children of that league). */
export function buildModuleLeagueBoard(
  profiles: ProfileRow[],
  scores: ScoreRow[],
  moduleId: SoftSkillsModuleId,
  leagueId: SoftSkillsLeagueId
) {
  const points = sumPoints(scores, { moduleId });
  const rows = profiles
    .filter((p) => p.soft_skills_league_id === leagueId)
    .map((p) => entryFromProfile(p, points.get(p.id) ?? 0));
  return assignPlaces(rows);
}

/** Overall: sum of all 6 modules. */
export function buildOverallBoard(profiles: ProfileRow[], scores: ScoreRow[]) {
  const points = sumPoints(scores);
  const rows = profiles
    .filter((p) => p.soft_skills_league_id || points.has(p.id))
    .map((p) => entryFromProfile(p, points.get(p.id) ?? 0));
  return assignPlaces(rows);
}

/** Team board (overall points among kids who have a team in any module — prefer module filter). */
export function buildTeamBoard(
  profiles: ProfileRow[],
  scores: ScoreRow[],
  teams: TeamRow[],
  opts?: { moduleId?: SoftSkillsModuleId }
) {
  const points = opts?.moduleId
    ? sumPoints(scores, { moduleId: opts.moduleId })
    : sumPoints(scores);

  const teamByUser = new Map<string, TeamRow>();
  for (const t of teams) {
    if (opts?.moduleId && t.module_id !== opts.moduleId) continue;
    // If overall, keep first team seen or prefer latest — one row per user for display
    if (!teamByUser.has(t.user_id)) teamByUser.set(t.user_id, t);
  }

  const byTeam = new Map<string, Omit<SoftSkillsRatingEntry, "place">[]>();
  for (const [userId, t] of teamByUser) {
    const p = profiles.find((x) => x.id === userId);
    if (!p) continue;
    const key = `${t.league_id}:${t.team_id}`;
    const list = byTeam.get(key) ?? [];
    list.push(
      entryFromProfile(p, points.get(userId) ?? 0, {
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

/** Class board (overall points). */
export function buildClassBoard(profiles: ProfileRow[], scores: ScoreRow[]) {
  const points = sumPoints(scores);
  const byClass = new Map<string, Omit<SoftSkillsRatingEntry, "place">[]>();

  for (const p of profiles) {
    const cls = p.class_name?.trim();
    if (!cls) continue;
    const list = byClass.get(cls) ?? [];
    list.push(entryFromProfile(p, points.get(p.id) ?? 0));
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

export async function getSoftSkillsPlacesForUser(userId: string) {
  const ctx = await loadSoftSkillsRatingContext();
  if (!ctx || ctx.error) {
    return {
      error: ctx?.error ?? "no_db",
      leaguePlace: null as number | null,
      classPlace: null as number | null,
      teamPlace: null as number | null,
      overallPlace: null as number | null,
      overallPoints: 0,
      leagueId: null as string | null,
      className: null as string | null,
      teamLabel: null as string | null,
    };
  }

  const me = ctx.profiles.find((p) => p.id === userId);
  const overall = buildOverallBoard(ctx.profiles, ctx.scores);
  const meOverall = overall.find((r) => r.userId === userId);

  let leaguePlace: number | null = null;
  if (me?.soft_skills_league_id) {
    const leagueBoard = assignPlaces(
      ctx.profiles
        .filter((p) => p.soft_skills_league_id === me.soft_skills_league_id)
        .map((p) =>
          entryFromProfile(p, sumPoints(ctx.scores).get(p.id) ?? 0)
        )
    );
    leaguePlace = leagueBoard.find((r) => r.userId === userId)?.place ?? null;
  }

  let classPlace: number | null = null;
  if (me?.class_name?.trim()) {
    const cls = buildClassBoard(ctx.profiles, ctx.scores).find(
      (c) => c.className === me.class_name?.trim()
    );
    classPlace = cls?.members.find((m) => m.userId === userId)?.place ?? null;
  }

  let teamPlace: number | null = null;
  let teamLabel: string | null = null;
  const myTeam = ctx.teams.find((t) => t.user_id === userId);
  if (myTeam) {
    teamLabel = getSoftSkillsTeam(myTeam.league_id, myTeam.team_id)?.label ?? myTeam.team_id;
    const teamBoards = buildTeamBoard(ctx.profiles, ctx.scores, ctx.teams, {
      moduleId: myTeam.module_id as SoftSkillsModuleId,
    });
    const board = teamBoards.find(
      (t) => t.leagueId === myTeam.league_id && t.teamId === myTeam.team_id
    );
    teamPlace = board?.members.find((m) => m.userId === userId)?.place ?? null;
  }

  return {
    error: null as string | null,
    leaguePlace,
    classPlace,
    teamPlace,
    overallPlace: meOverall?.place ?? null,
    overallPoints: meOverall?.points ?? 0,
    leagueId: me?.soft_skills_league_id ?? null,
    className: me?.class_name ?? null,
    teamLabel,
    modules: SOFT_SKILLS_MODULES.map((m) => m.id),
    leagues: SOFT_SKILLS_LEAGUES.map((l) => l.id),
  };
}
