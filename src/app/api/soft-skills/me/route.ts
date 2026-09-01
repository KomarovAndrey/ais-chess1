import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { getSoftSkillsPlacesForUser } from "@/lib/softSkillsRatings";
import { SOFT_SKILLS_LEAGUES } from "@/lib/softSkillsModules";

export async function GET() {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;

  const places = await getSoftSkillsPlacesForUser(auth.user.id);
  const leagueLabel =
    SOFT_SKILLS_LEAGUES.find((l) => l.id === places.leagueId)?.label ?? null;

  return NextResponse.json({
    ...places,
    leagueLabel,
    dashboard: places.dashboard,
  });
}
