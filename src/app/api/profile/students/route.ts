import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isStaffRole, resolveUserRole } from "@/lib/roles";

async function requireStaff() {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth;

  const { supabase, user } = auth;
  const role = await resolveUserRole(
    supabase,
    user.id,
    (await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()).data?.role ?? null
  );
  if (!isStaffRole(role)) {
    return {
      response: NextResponse.json({ error: "Access denied" }, { status: 403 }),
    } as const;
  }

  return auth;
}

/** Список учеников для админа и учителя. */
export async function GET(req: NextRequest) {
  const auth = await requireStaff();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  let query = supabase
    .from("profiles")
    .select("id, username, display_name, role")
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
    console.error("Students list error:", error);
    return NextResponse.json({ error: "Failed to load students" }, { status: 500 });
  }

  return NextResponse.json({ students: data ?? [] });
}
