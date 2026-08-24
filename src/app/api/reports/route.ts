import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** POST: report a user and/or game. */
export async function POST(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  if (!(await checkRateLimit(`report:${user.id}`))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const targetUserId =
    typeof body.targetUserId === "string" && UUID_REGEX.test(body.targetUserId)
      ? body.targetUserId
      : null;
  const gameId =
    typeof body.gameId === "string" && UUID_REGEX.test(body.gameId)
      ? body.gameId
      : null;

  if (!reason || reason.length < 3 || reason.length > 500) {
    return NextResponse.json(
      { error: "Укажите причину (3–500 символов)" },
      { status: 400 }
    );
  }
  if (!targetUserId && !gameId) {
    return NextResponse.json(
      { error: "Укажите пользователя или партию" },
      { status: 400 }
    );
  }
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Нельзя пожаловаться на себя" }, { status: 400 });
  }

  const { error } = await supabase.from("user_reports").insert({
    reporter_id: user.id,
    target_user_id: targetUserId,
    game_id: gameId,
    reason,
  });

  if (error) {
    if (error.message?.includes("user_reports") || error.code === "42P01") {
      return NextResponse.json(
        { error: "Жалобы недоступны. Выполните SQL миграцию Phase G." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
