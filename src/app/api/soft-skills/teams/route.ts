import { NextRequest, NextResponse } from "next/server";
import { requireStaffAuth } from "@/lib/softSkillsAuth";
import {
  getSoftSkillsTeam,
  getSoftSkillsTeams,
  isValidLeagueId,
  isValidModuleId,
} from "@/lib/softSkillsModules";

type StudentRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  soft_skills_league_id: string | null;
};

type ModuleAssignment = {
  user_id: string;
  league_id: string;
  team_id: string;
};

/** Editor payload: children of this league + current team; others in module are locked. */
export async function GET(req: NextRequest) {
  const auth = await requireStaffAuth();
  if ("response" in auth) return auth.response;

  const moduleId = req.nextUrl.searchParams.get("module")?.trim() ?? "";
  const leagueId = req.nextUrl.searchParams.get("league")?.trim() ?? "";
  const teamId = req.nextUrl.searchParams.get("team")?.trim() ?? "";

  if (!isValidModuleId(moduleId) || !isValidLeagueId(leagueId)) {
    return NextResponse.json({ error: "Неверный модуль или лига." }, { status: 400 });
  }

  const teams = getSoftSkillsTeams(leagueId)!;
  const team = teamId ? getSoftSkillsTeam(leagueId, teamId) : null;
  if (teamId && !team) {
    return NextResponse.json({ error: "Неверная команда." }, { status: 400 });
  }

  const db = auth.admin ?? auth.supabase;

  const { data: studentsRaw, error: studentsErr } = await db
    .from("profiles")
    .select("id, username, display_name, soft_skills_league_id")
    .eq("role", "student")
    .not("username", "is", null)
    .order("display_name", { ascending: true })
    .limit(200);

  if (studentsErr) {
    // Column may be missing before migration — retry without it
    if (studentsErr.message?.includes("soft_skills_league_id")) {
      const retry = await db
        .from("profiles")
        .select("id, username, display_name")
        .eq("role", "student")
        .not("username", "is", null)
        .order("display_name", { ascending: true })
        .limit(200);
      if (retry.error) {
        return NextResponse.json({ error: "Не удалось загрузить детей." }, { status: 500 });
      }
      return NextResponse.json({
        error:
          "Нужна миграция supabase-migration-soft-skills-league-binding.sql (колонка soft_skills_league_id).",
        teams,
        team,
        students: [],
        memberIds: [],
        locked: [],
      });
    }
    console.error("soft-skills students:", studentsErr);
    return NextResponse.json({ error: "Не удалось загрузить детей." }, { status: 500 });
  }

  const { data: moduleRows, error: moduleErr } = await db
    .from("soft_skills_team_members")
    .select("user_id, league_id, team_id")
    .eq("module_id", moduleId);

  if (moduleErr) {
    console.error("soft-skills module rows:", moduleErr);
    const missing = moduleErr.message?.includes("schema cache") || moduleErr.code === "42P01";
    return NextResponse.json(
      {
        error: missing
          ? "Таблица команд ещё не создана. Выполните supabase-migration-soft-skills-teams.sql в Supabase."
          : "Не удалось загрузить состав модуля.",
      },
      { status: 500 }
    );
  }

  const assignments = (moduleRows ?? []) as ModuleAssignment[];
  const assignmentByUser = new Map(assignments.map((a) => [a.user_id, a]));

  let memberIds: string[] = [];
  if (team) {
    memberIds = assignments
      .filter((a) => a.league_id === leagueId && a.team_id === teamId)
      .map((a) => a.user_id);
  }

  const allStudents = (studentsRaw ?? []) as StudentRow[];

  // Pool for this league: unbound or bound to this league
  const leagueStudents = allStudents.filter(
    (s) => !s.soft_skills_league_id || s.soft_skills_league_id === leagueId
  );

  const locked = assignments
    .filter((a) => !(a.league_id === leagueId && a.team_id === teamId))
    .map((a) => {
      const otherTeam =
        getSoftSkillsTeam(a.league_id, a.team_id)?.label ?? a.team_id;
      const student = allStudents.find((s) => s.id === a.user_id);
      return {
        userId: a.user_id,
        leagueId: a.league_id,
        teamId: a.team_id,
        teamLabel: otherTeam,
        displayName: student?.display_name ?? student?.username ?? null,
      };
    });

  // Available = league pool, not on another team in this module
  const students = leagueStudents.filter((s) => {
    const a = assignmentByUser.get(s.id);
    if (!a) return true;
    return a.league_id === leagueId && a.team_id === teamId;
  });

  return NextResponse.json({
    teams,
    team,
    students,
    memberIds,
    locked,
  });
}

/** Replace team roster. Enforces: one league binding, one team per module. */
export async function PUT(req: NextRequest) {
  const auth = await requireStaffAuth();
  if ("response" in auth) return auth.response;

  let body: {
    moduleId?: string;
    leagueId?: string;
    teamId?: string;
    memberIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const moduleId = String(body.moduleId ?? "").trim();
  const leagueId = String(body.leagueId ?? "").trim();
  const teamId = String(body.teamId ?? "").trim();
  const memberIds = Array.isArray(body.memberIds)
    ? [...new Set(body.memberIds.map((id) => String(id)).filter(Boolean))]
    : [];

  if (!isValidModuleId(moduleId) || !isValidLeagueId(leagueId)) {
    return NextResponse.json({ error: "Неверный модуль или лига." }, { status: 400 });
  }
  if (!getSoftSkillsTeam(leagueId, teamId)) {
    return NextResponse.json({ error: "Неверная команда." }, { status: 400 });
  }

  const db = auth.admin ?? auth.supabase;

  if (memberIds.length > 0) {
    const { data: profiles, error: profErr } = await db
      .from("profiles")
      .select("id, soft_skills_league_id, username, display_name")
      .in("id", memberIds);

    if (profErr) {
      if (profErr.message?.includes("soft_skills_league_id")) {
        return NextResponse.json(
          {
            error:
              "Выполните supabase-migration-soft-skills-league-binding.sql в Supabase (привязка к лиге).",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: "Не удалось проверить профили." }, { status: 500 });
    }

    for (const p of profiles ?? []) {
      const bound = (p as { soft_skills_league_id?: string | null }).soft_skills_league_id;
      if (bound && bound !== leagueId) {
        const name =
          (p as { display_name?: string | null }).display_name ||
          (p as { username?: string | null }).username ||
          "Ученик";
        return NextResponse.json(
          {
            error: `${name} уже привязан к лиге ${bound}. В эту лигу добавить нельзя.`,
          },
          { status: 400 }
        );
      }
    }

    const { data: conflicts, error: confErr } = await db
      .from("soft_skills_team_members")
      .select("user_id, league_id, team_id")
      .eq("module_id", moduleId)
      .in("user_id", memberIds);

    if (confErr) {
      return NextResponse.json({ error: "Не удалось проверить занятость в модуле." }, { status: 500 });
    }

    for (const row of conflicts ?? []) {
      if (row.league_id === leagueId && row.team_id === teamId) continue;
      const name =
        (profiles ?? []).find((p) => p.id === row.user_id)?.display_name ||
        (profiles ?? []).find((p) => p.id === row.user_id)?.username ||
        "Ученик";
      const other = getSoftSkillsTeam(row.league_id, row.team_id)?.label ?? row.team_id;
      return NextResponse.json(
        {
          error: `${name} уже в команде «${other}» этого модуля. Сначала уберите из той команды.`,
        },
        { status: 400 }
      );
    }
  }

  const { error: delErr } = await db
    .from("soft_skills_team_members")
    .delete()
    .eq("module_id", moduleId)
    .eq("league_id", leagueId)
    .eq("team_id", teamId);

  if (delErr) {
    console.error("soft-skills delete members:", delErr);
    return NextResponse.json({ error: "Не удалось обновить команду." }, { status: 500 });
  }

  if (memberIds.length > 0) {
    const rows = memberIds.map((userId) => ({
      module_id: moduleId,
      league_id: leagueId,
      team_id: teamId,
      user_id: userId,
      updated_at: new Date().toISOString(),
    }));

    const { error: insErr } = await db.from("soft_skills_team_members").insert(rows);
    if (insErr) {
      console.error("soft-skills insert members:", insErr);
      if (insErr.message?.includes("soft_skills_team_members_one_team_per_module")) {
        return NextResponse.json(
          { error: "Ребёнок уже состоит в другой команде этого модуля." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "Не удалось сохранить состав команды." }, { status: 500 });
    }

    const { error: bindErr } = await db
      .from("profiles")
      .update({ soft_skills_league_id: leagueId })
      .in("id", memberIds);

    if (bindErr) {
      console.error("soft-skills bind league:", bindErr);
      // Membership saved; league bind failed — surface clearly
      return NextResponse.json(
        {
          error:
            "Состав сохранён, но привязка к лиге не записалась. Выполните supabase-migration-soft-skills-league-binding.sql.",
          ok: true,
          memberIds,
        },
        { status: 200 }
      );
    }
  }

  return NextResponse.json({ ok: true, memberIds });
}
