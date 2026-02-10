import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PlayerInfo = { username: string | null; rating: number | null };

function ratingCategoryFromTimeControlSeconds(t: number | null | undefined): "bullet" | "blitz" | "rapid" {
  const v = typeof t === "number" && Number.isFinite(t) ? t : 300;
  if (v <= 120) return "bullet";
  if (v <= 300) return "blitz";
  return "rapid";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { gameId } = await params;
  if (!UUID_REGEX.test(gameId)) {
    return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  }

  const { data: game } = await supabase
    .from("games")
    .select("time_control_seconds")
    .eq("id", gameId)
    .maybeSingle();
  const category = ratingCategoryFromTimeControlSeconds((game as any)?.time_control_seconds);

  const { data: players, error: playersError } = await supabase
    .from("game_players")
    .select("side, player_id")
    .eq("game_id", gameId);

  if (playersError || !players?.length) {
    return NextResponse.json(
      { whitePlayer: { username: null, rating: null }, blackPlayer: { username: null, rating: null } },
      { status: 200 }
    );
  }

  const ids = players.map((p: { player_id: string }) => p.player_id).filter(Boolean);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, rating, rating_bullet, rating_blitz, rating_rapid")
    .in("id", ids);

  const pick = (r: any) => {
    const base = r?.rating ?? 1500;
    if (category === "bullet") return r?.rating_bullet ?? base;
    if (category === "blitz") return r?.rating_blitz ?? base;
    return r?.rating_rapid ?? base;
  };
  const byId = new Map(
    (profiles ?? []).map((r: { id: string; username: string | null }) => [
      r.id,
      { username: (r as any).username ?? null, rating: pick(r) }
    ])
  );
  const empty: PlayerInfo = { username: null, rating: null };
  const white = players.find((p: { side: string }) => p.side === "white");
  const black = players.find((p: { side: string }) => p.side === "black");

  return NextResponse.json({
    whitePlayer: white ? byId.get(white.player_id) ?? empty : empty,
    blackPlayer: black ? byId.get(black.player_id) ?? empty : empty
  });
}
