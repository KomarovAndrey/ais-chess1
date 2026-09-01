import { NextRequest, NextResponse } from "next/server";
import { requireStaffAuth } from "@/lib/softSkillsAuth";

/** Список учеников для админа и учителя. */
export async function GET(req: NextRequest) {
  const auth = await requireStaffAuth();
  if ("response" in auth) return auth.response;

  const db = auth.admin ?? auth.supabase;
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  let query = db
    .from("profiles")
    .select("id, username, display_name, role, class_name, soft_skills_league_id")
    .eq("role", "student")
    .not("username", "is", null)
    .order("display_name", { ascending: true })
    .limit(50);

  if (q.length >= 2) {
    const pattern = `%${q}%`;
    query = query.or(`username.ilike.${pattern},display_name.ilike.${pattern}`);
  }

  const { data, error } = await query;
  if (error) {
    if (error.message?.includes("class_name") || error.message?.includes("soft_skills_league_id")) {
      const retry = await db
        .from("profiles")
        .select("id, username, display_name, role")
        .eq("role", "student")
        .not("username", "is", null)
        .order("display_name", { ascending: true })
        .limit(50);
      if (retry.error) {
        console.error("Students list error:", retry.error);
        return NextResponse.json({ error: "Failed to load students" }, { status: 500 });
      }
      return NextResponse.json({ students: retry.data ?? [] });
    }

    console.error("Students list error:", error);
    return NextResponse.json({ error: "Failed to load students" }, { status: 500 });
  }

  return NextResponse.json({ students: data ?? [] });
}
