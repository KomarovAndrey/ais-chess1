import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import {
  SOFT_SKILLS_LEAGUES,
  getSoftSkillsTeams,
  isValidModuleId,
} from "@/lib/softSkillsModules";

type Member = {
  id: string;
  username: string | null;
  display_name: string | null;
};

/** Roster for a Soft Skills module: leagues → teams → children (authenticated). */
export async function GET(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;

  const moduleId = req.nextUrl.searchParams.get("module")?.trim() ?? "";
  if (!isValidModuleId(moduleId)) {
    return NextResponse.json({ error: "Неверный модуль." }, { status: 400 });
  }

  const { supabase } = auth;

  const { data: rows, error } = await supabase
    .from("soft_skills_team_members")
    .select("league_id, team_id, user_id")
    .eq("module_id", moduleId);

  if (error) {
    console.error("soft-skills roster:", error);
    const missing = error.message?.includes("schema cache") || error.code === "42P01";
    return NextResponse.json(
      {
        error: missing
          ? "Таблица команд ещё не создана. Выполните supabase-migration-soft-skills-teams.sql в Supabase."
          : "Не удалось загрузить команды.",
        leagues: [],
      },
      { status: missing ? 500 : 500 }
    );
  }

  const userIds = [...new Set((rows ?? []).map((r: { user_id: string }) => r.user_id))];
  const profileById = new Map<string, Member>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profileById.set(p.id, {
        id: p.id,
        username: p.username ?? null,
        display_name: p.display_name ?? null,
      });
    }
  }

  const membersByKey = new Map<string, Member[]>();
  for (const row of rows ?? []) {
    const key = `${row.league_id}:${row.team_id}`;
    const list = membersByKey.get(key) ?? [];
    const member = profileById.get(row.user_id);
    if (member) list.push(member);
    membersByKey.set(key, list);
  }

  const leagues = SOFT_SKILLS_LEAGUES.map((league) => {
    const teams = (getSoftSkillsTeams(league.id) ?? []).map((team) => {
      const members = membersByKey.get(`${league.id}:${team.id}`) ?? [];
      members.sort((a, b) =>
        (a.display_name || a.username || "").localeCompare(b.display_name || b.username || "", "ru")
      );
      return {
        id: team.id,
        label: team.label,
        members,
      };
    });
    return {
      id: league.id,
      label: league.label,
      teams,
    };
  });

  return NextResponse.json({ moduleId, leagues });
}
