import { NextRequest, NextResponse } from "next/server";
import { getSupabaseOptionalUser } from "@/lib/apiAuth";
import { isStaffRole, resolveUserRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSoftSkillsPlacesForUser } from "@/lib/softSkillsRatings";
import { SOFT_SKILLS_LEAGUES } from "@/lib/softSkillsModules";

async function targetIsPublicStudent(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "student";
}

/** Soft Skills places for a student (self, staff, or public read for students). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "User id required" }, { status: 400 });
  }

  const auth = await getSupabaseOptionalUser();
  if ("response" in auth) return auth.response;

  const viewerId = auth.user?.id ?? null;

  if (viewerId !== userId) {
    if (viewerId) {
      const { data: row } = await auth.supabase
        .from("profiles")
        .select("role")
        .eq("id", viewerId)
        .maybeSingle();

      const role = await resolveUserRole(
        auth.supabase,
        viewerId,
        typeof row?.role === "string" ? row.role : null
      );

      if (!isStaffRole(role)) {
        const isPublicStudent = await targetIsPublicStudent(userId);
        if (!isPublicStudent) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }
      }
    } else {
      const isPublicStudent = await targetIsPublicStudent(userId);
      if (!isPublicStudent) {
        return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
      }
    }
  }

  const places = await getSoftSkillsPlacesForUser(userId);
  const leagueLabel =
    SOFT_SKILLS_LEAGUES.find((l) => l.id === places.leagueId)?.label ?? null;

  return NextResponse.json({
    ...places,
    leagueLabel,
    dashboard: places.dashboard,
  });
}
