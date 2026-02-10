import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** DELETE: удалить из друзей (userId — id пользователя, которого убираем) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
  const me = auth.user.id;

  const { userId } = await params;
  if (!UUID_REGEX.test(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }
  if (userId === me) {
    return NextResponse.json({ error: "Нельзя удалить себя" }, { status: 400 });
  }

  const { data: rows } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("status", "accepted")
    .or(`and(from_user_id.eq.${me},to_user_id.eq.${userId}),and(from_user_id.eq.${userId},to_user_id.eq.${me})`);

  const idsToDelete = (rows ?? []).map((r: { id: string }) => r.id);
  if (idsToDelete.length === 0) {
    return NextResponse.json({ error: "Пользователь не в списке друзей" }, { status: 404 });
  }

  const { error } = await supabase.from("friend_requests").delete().in("id", idsToDelete);
  if (error) {
    console.error("Remove friend error:", error);
    return NextResponse.json({ error: "Не удалось удалить из друзей" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
