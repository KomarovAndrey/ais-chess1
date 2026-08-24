import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";

/** POST { puzzleId, success } — update puzzle Elo for logged-in user */
export async function POST(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  if (!await checkRateLimit(user.id)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { puzzleId?: string; success?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const puzzleId = typeof body.puzzleId === "string" ? body.puzzleId : "";
  if (!puzzleId) {
    return NextResponse.json({ error: "puzzleId required" }, { status: 400 });
  }
  if (typeof body.success !== "boolean") {
    return NextResponse.json({ error: "success required" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("apply_puzzle_result", {
    p_puzzle_id: puzzleId,
    p_success: body.success,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("puzzle_not_found")) {
      return NextResponse.json(
        { error: "Задача не найдена. Выполните SQL миграцию zadachi." },
        { status: 404 }
      );
    }
    if (msg.includes("profile_required")) {
      return NextResponse.json({ error: "Нужен профиль" }, { status: 400 });
    }
    console.error("apply_puzzle_result:", error);
    return NextResponse.json(
      { error: "Не удалось обновить рейтинг. Выполните SQL миграцию zadachi." },
      { status: 500 }
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    ok: true,
    userRating: row?.user_rating ?? null,
    puzzleRating: row?.puzzle_rating ?? null,
    userDelta: row?.user_delta ?? null,
  });
}
