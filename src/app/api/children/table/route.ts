import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { normalizeWeekNumber } from "@/lib/weekly";

async function requireTeacherOrAdmin() {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth;

  const { supabase, user } = auth;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["teacher", "admin"].includes(profile.role)) {
    return { response: NextResponse.json({ error: "Access denied" }, { status: 403 }) } as const;
  }

  return auth;
}

export async function GET(req: Request) {
  const auth = await requireTeacherOrAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
  const { searchParams } = new URL(req.url);
  const weekNumber = normalizeWeekNumber(searchParams.get("week"));

  // One query: children + nested comments with author profile
  const { data, error } = await supabase
    .from("children")
    .select(
      `
        id,
        created_at,
        team_name,
        full_name,
        class_name,
        child_comments:child_comments(
          id,
          created_at,
          body,
          author_id,
          week_number,
          author:author_id(
            id,
            username,
            display_name
          )
        )
      `
    )
    .order("team_name", { ascending: true, nullsFirst: false })
    .order("full_name", { ascending: true })
    .order("created_at", { referencedTable: "child_comments", ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const children =
    (data ?? []).map((child: any) => ({
      ...child,
      child_comments: Array.isArray(child.child_comments)
        ? child.child_comments.filter((comment: any) => comment.week_number === weekNumber)
        : [],
    })) ?? [];

  return NextResponse.json({ children, week_number: weekNumber });
}

