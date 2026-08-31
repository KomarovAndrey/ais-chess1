import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cron hook: pair idle Arena players across all started tournaments.
 * Secure with CRON_SECRET header or Vercel cron (Authorization: Bearer CRON_SECRET).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    const header = req.headers.get("x-cron-secret");
    if (bearer !== secret && header !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY required" },
      { status: 503 }
    );
  }

  const { data: tournaments, error } = await admin
    .from("tournaments")
    .select("id")
    .eq("status", "started")
    .eq("format", "arena");

  if (error) {
    console.error("arena-pair cron list:", error);
    return NextResponse.json({ error: "Failed to list tournaments" }, { status: 500 });
  }

  let paired = 0;
  for (const t of tournaments ?? []) {
    const { data, error: pairErr } = await admin.rpc("pair_arena_ready_players", {
      p_tournament_id: t.id,
    });
    if (pairErr) {
      console.error("pair_arena_ready_players:", pairErr);
      continue;
    }
    paired += typeof data === "number" ? data : 0;
  }

  return NextResponse.json({
    ok: true,
    tournaments: (tournaments ?? []).length,
    gamesCreated: paired,
  });
}
