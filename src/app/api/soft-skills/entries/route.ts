import { NextRequest, NextResponse } from "next/server";
import { requireStaffAuth } from "@/lib/softSkillsAuth";
import {
  disciplinesForLeague,
  emptyEntryFor,
  isValidDisciplineId,
  type SoftSkillsDisciplineEntry,
} from "@/lib/softSkillsDisciplines";
import {
  entriesMapFromRows,
  entryToDbPayload,
  rowToEntry,
  sanitizeStars,
} from "@/lib/softSkillsDisciplineDb";
import { isValidLeagueId, isValidModuleId } from "@/lib/softSkillsModules";

/** GET discipline entries for team members on a module week. */
export async function GET(req: NextRequest) {
  const auth = await requireStaffAuth();
  if ("response" in auth) return auth.response;

  const moduleId = req.nextUrl.searchParams.get("module")?.trim() ?? "";
  const weekRaw = req.nextUrl.searchParams.get("week");
  const leagueId = req.nextUrl.searchParams.get("league")?.trim() ?? "";
  const teamId = req.nextUrl.searchParams.get("team")?.trim() ?? "";
  const week = weekRaw ? Number(weekRaw) : 0;

  if (!isValidModuleId(moduleId) || !isValidLeagueId(leagueId) || !teamId || week < 1) {
    return NextResponse.json({ error: "Неверные параметры." }, { status: 400 });
  }

  const db = auth.admin ?? auth.supabase;
  const disciplines = disciplinesForLeague(leagueId);

  const { data: members, error: membersErr } = await db
    .from("soft_skills_team_members")
    .select("user_id")
    .eq("module_id", moduleId)
    .eq("league_id", leagueId)
    .eq("team_id", teamId);

  if (membersErr) {
    console.error("discipline entries members:", membersErr);
    return NextResponse.json({ error: "Не удалось загрузить команду." }, { status: 500 });
  }

  const userIds = (members ?? []).map((m) => m.user_id);
  if (userIds.length === 0) {
    return NextResponse.json({ entriesByUser: {} });
  }

  const { data: rows, error: rowsErr } = await db
    .from("soft_skills_discipline_entries")
    .select(
      "user_id, discipline, outcome, result_value, error_count, time_value, team_time, personal_time, goals_count, sport_error_count, star_leadership, star_communication, star_self_reflection, star_critical_thinking, star_self_control, updated_at"
    )
    .eq("module_id", moduleId)
    .eq("week_number", week)
    .in("user_id", userIds);

  if (rowsErr) {
    const missing =
      rowsErr.message?.includes("schema cache") ||
      rowsErr.message?.includes("soft_skills_discipline_entries");
    return NextResponse.json(
      {
        error: missing
          ? "Выполните supabase-migration-soft-skills-disciplines.sql в Supabase."
          : "Не удалось загрузить оценки.",
        entriesByUser: {},
      },
      { status: missing ? 500 : 500 }
    );
  }

  const entriesByUser: Record<string, Record<string, SoftSkillsDisciplineEntry>> = {};
  for (const userId of userIds) {
    const userRows = (rows ?? []).filter((r) => r.user_id === userId);
    entriesByUser[userId] = entriesMapFromRows(userRows, disciplines);
  }

  return NextResponse.json({ entriesByUser, disciplines });
}

/** PUT upsert one discipline entry for a child. */
export async function PUT(req: NextRequest) {
  const auth = await requireStaffAuth();
  if ("response" in auth) return auth.response;

  let body: {
    userId?: string;
    moduleId?: string;
    week?: number;
    leagueId?: string;
    discipline?: string;
    entry?: Partial<SoftSkillsDisciplineEntry>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = body.userId?.trim() ?? "";
  const moduleId = body.moduleId?.trim() ?? "";
  const week = body.week ?? 0;
  const leagueId = body.leagueId?.trim() ?? "";
  const discipline = body.discipline?.trim() ?? "";

  if (
    !userId ||
    !isValidModuleId(moduleId) ||
    week < 1 ||
    !isValidLeagueId(leagueId) ||
    !isValidDisciplineId(discipline)
  ) {
    return NextResponse.json({ error: "Неверные данные." }, { status: 400 });
  }

  if (!disciplinesForLeague(leagueId).includes(discipline)) {
    return NextResponse.json({ error: "Дисциплина недоступна для этой лиги." }, { status: 400 });
  }

  const db = auth.admin ?? auth.supabase;

  const { data: member } = await db
    .from("soft_skills_team_members")
    .select("user_id")
    .eq("module_id", moduleId)
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Ребёнок не в команде этого модуля." }, { status: 400 });
  }

  const base = emptyEntryFor(discipline);
  const patch = body.entry ?? {};
  const entry: SoftSkillsDisciplineEntry = {
    ...base,
    ...patch,
    discipline,
    resultValue:
      typeof patch.resultValue === "string"
        ? patch.resultValue.replace(/\D/g, "").slice(0, 6)
        : base.resultValue,
    errorCount: Math.max(0, Math.min(9999, Number(patch.errorCount) || 0)),
    goalsCount: Math.max(0, Math.min(9999, Number(patch.goalsCount) || 0)),
    sportErrorCount: Math.max(0, Math.min(9999, Number(patch.sportErrorCount) || 0)),
    timeValue: typeof patch.timeValue === "string" ? patch.timeValue.slice(0, 20) : base.timeValue,
    teamTime: typeof patch.teamTime === "string" ? patch.teamTime.slice(0, 20) : base.teamTime,
    personalTime:
      typeof patch.personalTime === "string" ? patch.personalTime.slice(0, 20) : base.personalTime,
    outcome: patch.outcome === "win" || patch.outcome === "lose" ? patch.outcome : null,
    stars: sanitizeStars({ ...base.stars, ...patch.stars }),
  };

  const payload = entryToDbPayload(entry, userId, moduleId, week, auth.user.id);

  const { data, error } = await db
    .from("soft_skills_discipline_entries")
    .upsert(payload, { onConflict: "user_id,module_id,week_number,discipline" })
    .select(
      "discipline, outcome, result_value, error_count, time_value, team_time, personal_time, goals_count, sport_error_count, star_leadership, star_communication, star_self_reflection, star_critical_thinking, star_self_control, updated_at"
    )
    .single();

  if (error) {
    console.error("discipline entry save:", error);
    const missing = error.message?.includes("soft_skills_discipline_entries");
    return NextResponse.json(
      {
        error: missing
          ? "Выполните supabase-migration-soft-skills-disciplines.sql в Supabase."
          : "Не удалось сохранить.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ entry: rowToEntry(data) });
}
