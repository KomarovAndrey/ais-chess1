import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

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

export async function GET() {
  const auth = await requireTeacherOrAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  // One query: children + nested comments with author profile
  const { data, error } = await supabase
    .from("children")
    .select(
      `
        id,
        created_at,
        full_name,
        class_name,
        child_comments:child_comments(
          id,
          created_at,
          body,
          author_id,
          author:author_id(
            id,
            username,
            display_name,
            email
          )
        )
      `
    )
    .order("full_name", { ascending: true })
    .order("created_at", { referencedTable: "child_comments", ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ children: data ?? [] });
}

