import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

export async function GET() {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("profiles")
    .select("username, display_name, bio, updated_at, rating")
    .eq("id", auth.user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Profile GET error:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }

  return NextResponse.json({
    username: data?.username ?? null,
    display_name: data?.display_name ?? "",
    bio: data?.bio ?? "",
    updated_at: data?.updated_at ?? null,
    rating: data?.rating ?? 1500
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

  let body: { display_name?: string; bio?: string; username?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("username, display_name, bio")
    .eq("id", user.id)
    .single();

  let newUsername: string | null = existing?.username ?? null;
  if (typeof body.username === "string") {
    const trimmed = body.username.trim().toLowerCase();
    if (!trimmed) newUsername = null;
    else if (!USERNAME_REGEX.test(trimmed)) {
      return NextResponse.json({ error: "Логин: только латиница, цифры и подчёркивание, 3–30 символов" }, { status: 400 });
    } else {
      const { data: taken } = await supabase.from("profiles").select("id").ilike("username", trimmed).limit(1).maybeSingle();
      if (taken && taken.id !== user.id) {
        return NextResponse.json({ error: "Этот логин уже занят" }, { status: 400 });
      }
      newUsername = trimmed;
    }
  }

  const merged = {
    username: newUsername,
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
    .select("username, display_name, bio, updated_at, rating")
    .single();

  if (error) {
    console.error("Profile PATCH error:", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  return NextResponse.json({
    username: data?.username ?? null,
    display_name: data?.display_name ?? "",
    bio: data?.bio ?? "",
    updated_at: data?.updated_at ?? null,
    rating: data?.rating ?? 1500
  });
}
