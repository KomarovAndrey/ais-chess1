import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** GET: статус дружбы/заявки с пользователем (id — id другого пользователя) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
  const me = auth.user.id;

  const { id: userId } = await params;
  if (!UUID_REGEX.test(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }
  if (userId === me) {
    return NextResponse.json({ status: "self" });
  }

  const { data: rows, error } = await supabase
    .from("friend_requests")
    .select("id, from_user_id, to_user_id, status")
    .or(`and(from_user_id.eq.${me},to_user_id.eq.${userId}),and(from_user_id.eq.${userId},to_user_id.eq.${me})`);

  if (error) {
    console.error("Friend status error:", error);
    return NextResponse.json({ error: "Failed to load status" }, { status: 500 });
  }

  const accepted = (rows ?? []).find((r) => r.status === "accepted");
  if (accepted) {
    return NextResponse.json({ status: "friends", requestId: accepted.id });
  }

  const pendingOutgoing = (rows ?? []).find(
    (r) => r.status === "pending" && r.from_user_id === me && r.to_user_id === userId
  );
  if (pendingOutgoing) {
    return NextResponse.json({ status: "pending_outgoing", requestId: pendingOutgoing.id });
  }

  const pendingIncoming = (rows ?? []).find(
    (r) => r.status === "pending" && r.from_user_id === userId && r.to_user_id === me
  );
  if (pendingIncoming) {
    return NextResponse.json({ status: "pending_incoming", requestId: pendingIncoming.id });
  }

  return NextResponse.json({ status: "none" });
}

/** DELETE: удалить из друзей (id — id пользователя, которого убираем) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
  const me = auth.user.id;

  const { id: userId } = await params;
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
