import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isStaffRole, resolveUserRole } from "@/lib/roles";
import { getSoftSkillsPlacesForUser } from "@/lib/softSkillsRatings";
import { SOFT_SKILLS_LEAGUES } from "@/lib/softSkillsModules";

/** Soft Skills places for a student (self or staff). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "User id required" }, { status: 400 });
  }

  if (auth.user.id !== userId) {
    const { data: row } = await auth.supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();

    const role = await resolveUserRole(
      auth.supabase,
      auth.user.id,
      typeof row?.role === "string" ? row.role : null
    );

    if (!isStaffRole(role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  const places = await getSoftSkillsPlacesForUser(userId);
  const leagueLabel =
    SOFT_SKILLS_LEAGUES.find((l) => l.id === places.leagueId)?.label ?? null;

  return NextResponse.json({
    ...places,
    leagueLabel,
  });
}
