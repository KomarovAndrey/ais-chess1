import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const { id: challengeId } = await params;
  if (!UUID_REGEX.test(challengeId)) {
    return NextResponse.json({ error: "Invalid challenge id" }, { status: 400 });
  }

  const { data: row, error: fetchErr } = await supabase
    .from("game_challenges")
    .select("id, status, from_user_id")
    .eq("id", challengeId)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Вызов не найден" }, { status: 404 });
  }
  if (row.from_user_id !== user.id) {
    return NextResponse.json({ error: "Нельзя отменить чужой вызов" }, { status: 403 });
  }
  if (row.status !== "pending") {
    return NextResponse.json({ error: "Вызов уже обработан" }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from("game_challenges")
    .update({ status: "cancelled", responded_at: new Date().toISOString() })
    .eq("id", challengeId);

  if (updateErr) {
    console.error("Challenge cancel error:", updateErr);
    return NextResponse.json({ error: "Не удалось отменить" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

