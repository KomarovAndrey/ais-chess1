import { NextRequest, NextResponse } from "next/server";
import { requireStaffAuth } from "@/lib/softSkillsAuth";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** Список учеников для админа и учителя. */
export async function GET(req: NextRequest) {
  const auth = await requireStaffAuth();
  if ("response" in auth) return auth.response;

  const db = auth.admin ?? auth.supabase;
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const offset = Math.max(0, Number.parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(req.nextUrl.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );

  const baseSelect =
    "id, username, display_name, role, class_name, soft_skills_league_id";

  let countQuery = db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "student")
    .not("username", "is", null);

  let dataQuery = db
    .from("profiles")
    .select(baseSelect)
    .eq("role", "student")
    .not("username", "is", null)
    .order("display_name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (q.length >= 2) {
    const pattern = `%${q}%`;
    const filter = `username.ilike.${pattern},display_name.ilike.${pattern}`;
    countQuery = countQuery.or(filter);
    dataQuery = dataQuery.or(filter);
  }

  const [{ count }, { data, error }] = await Promise.all([countQuery, dataQuery]);

  if (error) {
    if (error.message?.includes("class_name") || error.message?.includes("soft_skills_league_id")) {
      let retryCount = db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student")
        .not("username", "is", null);
      let retryData = db
        .from("profiles")
        .select("id, username, display_name, role")
        .eq("role", "student")
        .not("username", "is", null)
        .order("display_name", { ascending: true })
        .range(offset, offset + limit - 1);
      if (q.length >= 2) {
        const pattern = `%${q}%`;
        const filter = `username.ilike.${pattern},display_name.ilike.${pattern}`;
        retryCount = retryCount.or(filter);
        retryData = retryData.or(filter);
      }
      const [countRes, dataRes] = await Promise.all([retryCount, retryData]);
      if (dataRes.error) {
        console.error("Students list error:", dataRes.error);
        return NextResponse.json({ error: "Failed to load students" }, { status: 500 });
      }
      const total = countRes.count ?? 0;
      const students = dataRes.data ?? [];
      return NextResponse.json({
        students,
        total,
        offset,
        hasMore: offset + students.length < total,
      });
    }

    console.error("Students list error:", error);
    return NextResponse.json({ error: "Failed to load students" }, { status: 500 });
  }

  const students = data ?? [];
  const total = count ?? students.length;
  return NextResponse.json({
    students,
    total,
    offset,
    hasMore: offset + students.length < total,
  });
}
