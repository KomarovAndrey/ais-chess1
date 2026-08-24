import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** POST: heartbeat — mark user online, optionally in a game. */
export async function POST(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const body = await req.json().catch(() => ({}));
  const gameId =
    typeof body.gameId === "string" && UUID_REGEX.test(body.gameId)
      ? body.gameId
      : null;

  const { error } = await supabase.rpc("heartbeat_presence", {
    p_game_id: gameId,
  });

  if (error) {
    // Fallback if RPC missing: direct update
    if (
      error.message?.includes("heartbeat_presence") ||
      error.message?.includes("Could not find the function")
    ) {
      const { error: updErr } = await supabase
        .from("profiles")
        .update({
          last_seen_at: new Date().toISOString(),
          current_game_id: gameId,
        })
        .eq("id", auth.user.id);
      if (updErr && !updErr.message?.includes("last_seen_at")) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, fallback: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
