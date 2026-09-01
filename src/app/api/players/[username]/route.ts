import { NextRequest, NextResponse } from "next/server";
import { getSupabaseOptionalUser } from "@/lib/apiAuth";
import { checkPublicReadRateLimit, getRequestIp } from "@/lib/rateLimit";
import { isStaffRole, resolveUserRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OptionalAuthResult } from "@/lib/apiAuth";

async function resolveProfileDb(auth: OptionalAuthResult) {
  if (!auth.user) return auth.supabase;

  const { data: row } = await auth.supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const role = await resolveUserRole(
    auth.supabase,
    auth.user.id,
    typeof row?.role === "string" ? row.role : null
  );

  if (isStaffRole(role)) {
    return createAdminClient() ?? auth.supabase;
  }

  return auth.supabase;
}

function serializeProfile(profile: Record<string, unknown>) {
  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name ?? profile.username,
    bio: profile.bio ?? "",
    updated_at: profile.updated_at,
    avatar_url: profile.avatar_url ?? null,
    role: typeof profile.role === "string" ? profile.role : "student",
    class_name: typeof profile.class_name === "string" ? profile.class_name : null,
    soft_skills_league_id:
      typeof profile.soft_skills_league_id === "string" ? profile.soft_skills_league_id : null,
  };
}

const PROFILE_SELECT_CANDIDATES = [
  "id, username, display_name, bio, updated_at, avatar_url, role, class_name, soft_skills_league_id",
  "id, username, display_name, bio, updated_at, avatar_url, role",
  "id, username, display_name, bio, updated_at",
] as const;

async function fetchProfileByUsername(
  supabase: Awaited<ReturnType<typeof resolveProfileDb>>,
  username: string
) {
  let lastError: string | null = null;

  for (const select of PROFILE_SELECT_CANDIDATES) {
    const { data, error } = await supabase
      .from("profiles")
      .select(select)
      .ilike("username", username)
      .maybeSingle();

    if (!error) {
      return { profile: data as Record<string, unknown> | null, error: null as string | null };
    }

    lastError = error.message ?? "Failed to load profile";
    if (!lastError.includes("does not exist")) {
      return { profile: null, error: lastError };
    }
  }

  return { profile: null, error: lastError };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const ip = getRequestIp(req);
  if (!(await checkPublicReadRateLimit(ip))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const auth = await getSupabaseOptionalUser();
  if ("response" in auth) return auth.response;
  const supabase = await resolveProfileDb(auth);

  const { username: routeUsername } = await params;
  const username = decodeURIComponent(routeUsername).trim().toLowerCase();
  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const loaded = await fetchProfileByUsername(supabase, username);
  if (loaded.error) {
    console.error("Profile fetch error:", loaded.error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
  if (!loaded.profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    profile: serializeProfile(loaded.profile),
  });
}
