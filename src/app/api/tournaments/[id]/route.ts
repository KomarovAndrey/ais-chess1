import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid tournament id" }, { status: 400 });
  }

  await supabase.rpc("refresh_tournament_status", { p_id: id });

  const { data: tournament, error: tError } = await supabase
    .from("tournaments")
    .select(
      "id, title, status, format, created_at, max_players, starts_at, ends_at, created_by, time_control_seconds, increment_seconds, rated, duration_minutes"
    )
    .eq("id", id)
    .single();

  if (tError || !tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const { data: players, error: pError } = await supabase
    .from("tournament_players")
    .select("user_id, joined_at, score, games_played, withdrawn, pairing_ready")
    .eq("tournament_id", id)
    .order("score", { ascending: false })
    .order("games_played", { ascending: false });

  if (pError) {
    // Columns may be missing before arena migration
    const fallback = await supabase
      .from("tournament_players")
      .select("user_id, joined_at")
      .eq("tournament_id", id)
      .order("joined_at", { ascending: true });
    if (fallback.error) {
      return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    }
    const userIds = (fallback.data ?? []).map((p) => p.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", userIds);
    const byId = new Map((profiles ?? []).map((r) => [r.id, r]));
    return NextResponse.json({
      ...tournament,
      joined: userIds.includes(user.id),
      players: (fallback.data ?? []).map((p) => ({
        user_id: p.user_id,
        joined_at: p.joined_at,
        score: 0,
        games_played: 0,
        withdrawn: false,
        username: byId.get(p.user_id)?.username ?? null,
        display_name: byId.get(p.user_id)?.display_name ?? null,
      })),
    });
  }

  type ProfileRow = { id: string; username: string | null; display_name: string | null };
  const userIds = (players ?? []).map((p) => p.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", userIds);

  const byId = new Map<string, ProfileRow>(
    (profiles ?? []).map((r: ProfileRow) => [r.id, r])
  );

  const playersWithProfile = (players ?? []).map((p) => {
    const profile = byId.get(p.user_id);
    return {
      user_id: p.user_id,
      joined_at: p.joined_at,
      score: Number(p.score ?? 0),
      games_played: Number(p.games_played ?? 0),
      withdrawn: Boolean(p.withdrawn),
      pairing_ready: (p as { pairing_ready?: string | null }).pairing_ready ?? null,
      username: profile?.username ?? null,
      display_name: profile?.display_name ?? null,
    };
  });

  return NextResponse.json({
    ...tournament,
    joined: playersWithProfile.some((p) => p.user_id === user.id && !p.withdrawn),
    players: playersWithProfile,
  });
}
