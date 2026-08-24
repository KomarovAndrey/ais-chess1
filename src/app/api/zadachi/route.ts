import { NextRequest, NextResponse } from "next/server";
import { getSupabaseOptionalUser } from "@/lib/apiAuth";
import { ZADACHI_SEED, type Zadacha } from "@/lib/zadachi-data";

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

/** GET /api/zadachi?theme=&exclude=id — next task near user rating */
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

  let query = supabase
    .from("puzzles")
    .select("id, fen, moves, themes, rating")
    .order("rating", { ascending: true })
    .limit(80);

  if (exclude) query = query.neq("id", exclude);
  if (theme) query = query.contains("themes", [theme]);

  const { data, error } = await query;

  let pool: Zadacha[] = [];
  if (!error && data && data.length > 0) {
    pool = data.map(mapRow);
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
    pick = pool[h % pool.length];
  } else {
    pool.sort(
      (a, b) =>
        Math.abs(a.rating - userRating) - Math.abs(b.rating - userRating)
    );
    const top = pool.slice(0, Math.min(12, pool.length));
    pick = top[Math.floor(Math.random() * top.length)];
  }

  // Distinct themes for UI chips
  const themes = Array.from(
    new Set(
      (data && data.length > 0
        ? data.flatMap((r) => r.themes ?? [])
        : ZADACHI_SEED.flatMap((z) => z.themes)
      ).filter(Boolean)
    )
  ).sort();

  return NextResponse.json({
    zadacha: pick,
    userRating,
    themes,
    source: data && data.length > 0 ? "db" : "seed",
    daily: daily || undefined,
    dailyKey: daily ? today : undefined,
  });
}
