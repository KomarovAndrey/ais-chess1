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
  const { supabase } = auth;

  let body: { full_name?: string; class_name?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const className = typeof body.class_name === "string" ? body.class_name.trim() : null;

  if (!fullName) return NextResponse.json({ error: "full_name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("children")
    .insert({ full_name: fullName.slice(0, 200), class_name: className ? className.slice(0, 50) : null })
    .select("id, created_at, full_name, class_name")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ child: data });
}

