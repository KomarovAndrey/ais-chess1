import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type HistoryRow = {
  category: "bullet" | "blitz" | "rapid";
  rating: number;
  created_at: string;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { userId } = await params;
  if (!UUID_REGEX.test(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("rating_history")
    .select("category, rating, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) {
    console.error("Rating history error:", error);
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }

  const rows = (data ?? []) as HistoryRow[];
  const bullet = rows.filter((r) => r.category === "bullet").map((r) => ({ t: r.created_at, r: r.rating }));
  const blitz = rows.filter((r) => r.category === "blitz").map((r) => ({ t: r.created_at, r: r.rating }));
  const rapid = rows.filter((r) => r.category === "rapid").map((r) => ({ t: r.created_at, r: r.rating }));

  return NextResponse.json({ bullet, blitz, rapid });
}

