import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  const auth = await requireTeacherOrAdmin();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  let body: { child_id?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const childId = typeof body.child_id === "string" ? body.child_id : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!childId) return NextResponse.json({ error: "child_id is required" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("child_comments")
    .insert({ child_id: childId, author_id: user.id, body: text.slice(0, 4000) })
    .select("id, created_at, body, author_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ comment: data });
}

