import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

export async function GET() {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, bio, updated_at")
    .eq("id", auth.user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Profile GET error:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }

  return NextResponse.json({
    display_name: data?.display_name ?? "",
    bio: data?.bio ?? "",
    updated_at: data?.updated_at ?? null
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  let body: { display_name?: string; bio?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("display_name, bio")
    .eq("id", user.id)
    .single();

  const merged = {
    display_name: typeof body.display_name === "string" ? body.display_name.slice(0, 100) : (existing?.display_name ?? ""),
    bio: typeof body.bio === "string" ? body.bio.slice(0, 2000) : (existing?.bio ?? ""),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, ...merged },
      { onConflict: "id", ignoreDuplicates: false }
    )
    .select("display_name, bio, updated_at")
    .single();

  if (error) {
    console.error("Profile PATCH error:", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  return NextResponse.json({
    display_name: data?.display_name ?? "",
    bio: data?.bio ?? "",
    updated_at: data?.updated_at ?? null
  });
}
