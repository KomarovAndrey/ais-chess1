import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid tournament id" }, { status: 400 });
  }

  const { data: tournament, error: tError } = await supabase
    .from("tournaments")
    .select("id, title, status, format, created_at, max_players, starts_at, created_by")
    .eq("id", id)
    .single();

  if (tError || !tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const { data: players, error: pError } = await supabase
    .from("tournament_players")
    .select("user_id, joined_at")
    .eq("tournament_id", id)
    .order("joined_at", { ascending: true });

  if (pError) {
    return NextResponse.json({ error: pError.message }, { status: 500 });
  }

  const userIds = (players ?? []).map((p: { user_id: string }) => p.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", userIds);

  const byId = new Map((profiles ?? []).map((r: { id: string }) => [r.id, r]));
  const playersWithProfile = (players ?? []).map((p: { user_id: string; joined_at: string }) => ({
    user_id: p.user_id,
    joined_at: p.joined_at,
    username: (byId.get(p.user_id) as { username: string | null })?.username ?? null,
    display_name: (byId.get(p.user_id) as { display_name: string | null })?.display_name ?? null
  }));

  return NextResponse.json({
    ...tournament,
    players: playersWithProfile
  });
}
