import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isStaffRole, resolveUserRole } from "@/lib/roles";

export async function GET() {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "username, display_name, bio, updated_at, rating, rating_bullet, rating_blitz, rating_rapid, rating_puzzle, avatar_url, games_played_bullet, games_played_blitz, games_played_rapid, role"
    )
    .eq("id", auth.user.id)
    .single();

  let row = data as Record<string, unknown> | null;
  if (error && error.message?.includes("rating_puzzle")) {
    const retry = await supabase
      .from("profiles")
      .select(
        "username, display_name, bio, updated_at, rating, rating_bullet, rating_blitz, rating_rapid, avatar_url, games_played_bullet, games_played_blitz, games_played_rapid"
      )
      .eq("id", auth.user.id)
      .single();
    if (retry.error && retry.error.code !== "PGRST116") {
      console.error("Profile GET error:", retry.error);
      return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
    }
    row = retry.data as Record<string, unknown> | null;
  } else if (error && error.code !== "PGRST116") {
    console.error("Profile GET error:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }

  const role = await resolveUserRole(
    supabase,
    auth.user.id,
    typeof row?.role === "string" ? row.role : null
  );

  return NextResponse.json({
    id: auth.user.id,
    username: row?.username ?? null,
    display_name: row?.display_name ?? "",
    bio: row?.bio ?? "",
    updated_at: row?.updated_at ?? null,
    rating: row?.rating ?? row?.rating_blitz ?? 1500,
    rating_bullet: row?.rating_bullet ?? row?.rating ?? 1500,
    rating_blitz: row?.rating_blitz ?? row?.rating ?? 1500,
    rating_rapid: row?.rating_rapid ?? row?.rating ?? 1500,
    rating_puzzle: row?.rating_puzzle ?? 1500,
    avatar_url: row?.avatar_url ?? null,
    games_played_bullet: row?.games_played_bullet ?? 0,
    games_played_blitz: row?.games_played_blitz ?? 0,
    games_played_rapid: row?.games_played_rapid ?? 0,
    role,
    is_staff: isStaffRole(role),
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
    .select("username, display_name, bio, avatar_url, role")
    .eq("id", user.id)
    .single();

  const staffRole = await resolveUserRole(
    supabase,
    user.id,
    typeof existing?.role === "string" ? existing.role : null
  );
  const staff = isStaffRole(staffRole);

  const newUsername = existing?.username ?? null;

  const merged: Record<string, unknown> = {
    username: newUsername,
    display_name:
      typeof body.display_name === "string"
        ? body.display_name.slice(0, 100)
        : (existing?.display_name ?? ""),
    updated_at: new Date().toISOString(),
  };

  if (!staff) {
    merged.bio =
      typeof body.bio === "string" ? body.bio.slice(0, 2000) : (existing?.bio ?? "");
  } else {
    merged.bio = existing?.bio ?? "";
  }

  if (typeof body.avatar_url === "string") {
    merged.avatar_url = body.avatar_url.slice(0, 500) || null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, ...merged }, { onConflict: "id", ignoreDuplicates: false })
    .select(
      "username, display_name, bio, updated_at, rating, rating_bullet, rating_blitz, rating_rapid, avatar_url, games_played_bullet, games_played_blitz, games_played_rapid, role"
    )
    .single();

  if (error) {
    console.error("Profile PATCH error:", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  const patchRole = await resolveUserRole(
    supabase,
    user.id,
    typeof data?.role === "string" ? data.role : staffRole
  );

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
    role: patchRole,
    is_staff: isStaffRole(patchRole),
  });
}
