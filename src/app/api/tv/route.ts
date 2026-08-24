import { NextResponse } from "next/server";
import { getSupabaseOptionalUser } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";

type LiveGame = {
  id: string;
  status: string;
  time_control_seconds: number;
  increment_seconds: number | null;
  rated: boolean | null;
  started_at: string | null;
  last_move_at: string | null;
  white: { username: string | null; rating: number | null };
  black: { username: string | null; rating: number | null };
};

/** GET: list of live (active) games for TV. */
export async function GET() {
  const auth = await getSupabaseOptionalUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
  const admin = createAdminClient();
  const client = admin ?? supabase;

  const { data: games, error } = await client
    .from("games")
    .select(
      "id, status, time_control_seconds, increment_seconds, rated, started_at, last_move_at"
    )
    .eq("status", "active")
    .order("last_move_at", { ascending: false, nullsFirst: false })
    .limit(40);

  if (error) {
    console.error("tv list:", error);
    return NextResponse.json({ error: "Не удалось загрузить трансляции" }, { status: 500 });
  }

  const list = games ?? [];
  if (list.length === 0) {
    return NextResponse.json({ games: [] as LiveGame[] });
  }

  const ids = list.map((g) => g.id);
  const { data: players } = await client
    .from("game_players")
    .select("game_id, side, player_id")
    .in("game_id", ids);

  const playerIds = Array.from(
    new Set((players ?? []).map((p) => p.player_id).filter(Boolean))
  );

  const profilesById = new Map<
    string,
    { username: string | null; rating: number | null }
  >();
  if (playerIds.length > 0) {
    const { data: profiles } = await client
      .from("profiles")
      .select("id, username, rating, rating_blitz")
      .in("id", playerIds);
    for (const p of profiles ?? []) {
      profilesById.set(p.id, {
        username: p.username ?? null,
        rating: (p as { rating_blitz?: number }).rating_blitz ?? p.rating ?? 1500,
      });
    }
  }

  const byGame = new Map<string, { white?: string; black?: string }>();
  for (const p of players ?? []) {
    const row = byGame.get(p.game_id) ?? {};
    if (p.side === "white") row.white = p.player_id;
    if (p.side === "black") row.black = p.player_id;
    byGame.set(p.game_id, row);
  }

  const empty = { username: null, rating: null };
  const result: LiveGame[] = list.map((g) => {
    const seats = byGame.get(g.id) ?? {};
    return {
      id: g.id,
      status: g.status,
      time_control_seconds: g.time_control_seconds,
      increment_seconds: g.increment_seconds ?? 0,
      rated: g.rated ?? true,
      started_at: g.started_at,
      last_move_at: g.last_move_at,
      white: seats.white ? profilesById.get(seats.white) ?? empty : empty,
      black: seats.black ? profilesById.get(seats.black) ?? empty : empty,
    };
  });

  return NextResponse.json({ games: result });
}
