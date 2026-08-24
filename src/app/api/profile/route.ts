import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

export async function GET() {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "username, display_name, bio, updated_at, rating, rating_bullet, rating_blitz, rating_rapid, avatar_url, games_played_bullet, games_played_blitz, games_played_rapid"
    )
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
    rating: data?.rating ?? data?.rating_blitz ?? 1500,
    rating_bullet: data?.rating_bullet ?? data?.rating ?? 1500,
    rating_blitz: data?.rating_blitz ?? data?.rating ?? 1500,
    rating_rapid: data?.rating_rapid ?? data?.rating ?? 1500,
    avatar_url: data?.avatar_url ?? null,
    games_played_bullet: data?.games_played_bullet ?? 0,
    games_played_blitz: data?.games_played_blitz ?? 0,
    games_played_rapid: data?.games_played_rapid ?? 0,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  let body: { display_name?: string; bio?: string; username?: string; avatar_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("username, display_name, bio, avatar_url")
    .eq("id", user.id)
    .single();

  const newUsername = existing?.username ?? null;

  const merged: Record<string, unknown> = {
    username: newUsername,
    display_name:
      typeof body.display_name === "string"
        ? body.display_name.slice(0, 100)
        : (existing?.display_name ?? ""),
    bio:
      typeof body.bio === "string" ? body.bio.slice(0, 2000) : (existing?.bio ?? ""),
    updated_at: new Date().toISOString(),
  };

  if (typeof body.avatar_url === "string") {
    merged.avatar_url = body.avatar_url.slice(0, 500) || null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, ...merged }, { onConflict: "id", ignoreDuplicates: false })
    .select(
      "username, display_name, bio, updated_at, rating, rating_bullet, rating_blitz, rating_rapid, avatar_url, games_played_bullet, games_played_blitz, games_played_rapid"
    )
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
    rating: data?.rating ?? data?.rating_blitz ?? 1500,
    rating_bullet: data?.rating_bullet ?? data?.rating ?? 1500,
    rating_blitz: data?.rating_blitz ?? data?.rating ?? 1500,
    rating_rapid: data?.rating_rapid ?? data?.rating ?? 1500,
    avatar_url: data?.avatar_url ?? null,
    games_played_bullet: data?.games_played_bullet ?? 0,
    games_played_blitz: data?.games_played_blitz ?? 0,
    games_played_rapid: data?.games_played_rapid ?? 0,
  });
}
