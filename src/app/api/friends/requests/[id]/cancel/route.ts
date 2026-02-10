import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** POST: отменить исходящую заявку в друзья (id — id заявки) */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
  const me = auth.user.id;

  const { id: requestId } = await params;
  if (!UUID_REGEX.test(requestId)) {
    return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
  }

  const { data: row, error: fetchErr } = await supabase
    .from("friend_requests")
    .select("id, from_user_id, status")
    .eq("id", requestId)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  }
  if (row.from_user_id !== me) {
    return NextResponse.json({ error: "Нельзя отменить чужую заявку" }, { status: 403 });
  }
  if (row.status !== "pending") {
    return NextResponse.json({ error: "Заявка уже обработана" }, { status: 400 });
  }

  const { error: deleteErr } = await supabase
    .from("friend_requests")
    .delete()
    .eq("id", requestId);

  if (deleteErr) {
    console.error("Cancel friend request error:", deleteErr);
    return NextResponse.json({ error: "Не удалось отменить заявку" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

