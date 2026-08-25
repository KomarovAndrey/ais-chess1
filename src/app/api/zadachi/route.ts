import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseOptionalUser } from "@/lib/apiAuth";
import { COMMON_PUZZLE_THEMES, ZADACHI_SEED, type Zadacha } from "@/lib/zadachi-data";

function mapRow(r: {
  id: string;
  fen: string;
  moves: string[] | null;
  themes?: string[] | null;
  rating?: number | null;
}): Zadacha {
  return {
    id: r.id,
    fen: r.fen,
    moves: Array.isArray(r.moves) ? r.moves : [],
    themes: Array.isArray(r.themes) ? r.themes : [],
    rating: typeof r.rating === "number" ? r.rating : 1500,
  };
}

type PuzzleRow = {
  id: string;
  fen: string;
  moves: string[] | null;
  themes?: string[] | null;
  rating?: number | null;
};

async function fetchNearRating(
  supabase: SupabaseClient,
  userRating: number,
  theme: string | null,
  exclude: string | null
): Promise<PuzzleRow[]> {
  const windows: [number, number][] = [
    [userRating - 120, userRating + 120],
    [userRating - 250, userRating + 250],
    [userRating - 450, userRating + 450],
    [400, 2800],
  ];

  for (const [lo, hi] of windows) {
    let query = supabase
      .from("puzzles")
      .select("id, fen, moves, themes, rating")
      .gte("rating", lo)
      .lte("rating", hi)
      .limit(64);

    if (exclude) query = query.neq("id", exclude);
    if (theme) query = query.contains("themes", [theme]);

    const { data, error } = await query;
    if (!error && data && data.length > 0) return data as PuzzleRow[];
  }
  return [];
}

/** GET /api/zadachi?theme=&exclude=id&daily=1 — next task near user rating */
export async function GET(req: NextRequest) {
  const auth = await getSupabaseOptionalUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const theme = req.nextUrl.searchParams.get("theme");
  const exclude = req.nextUrl.searchParams.get("exclude");
  const daily = req.nextUrl.searchParams.get("daily") === "1";

  let userRating = 1500;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("rating_puzzle")
      .eq("id", user.id)
      .maybeSingle();
    if (typeof profile?.rating_puzzle === "number") {
      userRating = profile.rating_puzzle;
    }
  }

  const data = await fetchNearRating(supabase, userRating, theme, exclude);

  let pool: Zadacha[] = [];
  let source: "db" | "seed" = "seed";
  if (data.length > 0) {
    pool = data.map(mapRow);
    source = "db";
  } else {
    pool = ZADACHI_SEED.filter((z) => {
      if (exclude && z.id === exclude) return false;
      if (theme && !z.themes.includes(theme)) return false;
      return true;
    });
  }

  if (pool.length === 0) {
    return NextResponse.json({ error: "Нет задач" }, { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);
  let pick: Zadacha;
  if (daily) {
    let h = 0;
    for (let i = 0; i < today.length; i++) h = (h * 31 + today.charCodeAt(i)) >>> 0;
    // Prefer a stable daily from a broader DB sample when available.
    if (source === "db") {
      const { data: dailyPool } = await supabase
        .from("puzzles")
        .select("id, fen, moves, themes, rating")
        .order("id", { ascending: true })
        .limit(500);
      const list = dailyPool && dailyPool.length > 0 ? dailyPool.map(mapRow) : pool;
      pick = list[h % list.length];
    } else {
      pick = pool[h % pool.length];
    }
  } else {
    pool.sort(
      (a, b) => Math.abs(a.rating - userRating) - Math.abs(b.rating - userRating)
    );
    const top = pool.slice(0, Math.min(16, pool.length));
    pick = top[Math.floor(Math.random() * top.length)];
  }

  const themes = Array.from(
    new Set([
      ...COMMON_PUZZLE_THEMES,
      ...pool.flatMap((z) => z.themes),
    ])
  ).sort();

  return NextResponse.json({
    zadacha: pick,
    userRating,
    themes,
    source,
    daily: daily || undefined,
    dailyKey: daily ? today : undefined,
  });
}
