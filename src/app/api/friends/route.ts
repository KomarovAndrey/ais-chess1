import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

/** GET: список друзей и заявок */
export async function GET() {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
  const me = auth.user.id;

  const { data: requests, error: reqError } = await supabase
    .from("friend_requests")
    .select("id, from_user_id, to_user_id, status, created_at")
    .or(`from_user_id.eq.${me},to_user_id.eq.${me}`);

  if (reqError) {
    console.error("Friends list error:", reqError);
    return NextResponse.json({ error: "Failed to load friends" }, { status: 500 });
  }

  const friends: { id: string; username: string | null; display_name: string; rating: number }[] = [];
  const pendingIncoming: { id: string; from_user: { id: string; username: string | null; display_name: string; rating: number } }[] = [];
  const pendingOutgoing: { id: string; to_user: { id: string; username: string | null; display_name: string; rating: number } }[] = [];

  const accepted = (requests ?? []).filter((r) => r.status === "accepted");
  const incoming = (requests ?? []).filter((r) => r.status === "pending" && r.to_user_id === me);
  const outgoing = (requests ?? []).filter((r) => r.status === "pending" && r.from_user_id === me);

  const allOtherIds = new Set<string>();
  accepted.forEach((r) => {
    allOtherIds.add(r.from_user_id === me ? r.to_user_id : r.from_user_id);
  });
  incoming.forEach((r) => allOtherIds.add(r.from_user_id));
  outgoing.forEach((r) => allOtherIds.add(r.to_user_id));

  if (allOtherIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, rating, rating_blitz")
      .in("id", Array.from(allOtherIds));
    const byId = new Map(
      (profiles ?? []).map(
        (p: { id: string; username: string | null; display_name: string; rating?: number; rating_blitz?: number }) => [
          p.id,
          { ...p, rating: (p as any).rating_blitz ?? (p as any).rating ?? 1500 }
        ]
      )
    );

    accepted.forEach((r) => {
      const otherId = r.from_user_id === me ? r.to_user_id : r.from_user_id;
      const p = byId.get(otherId);
      if (p) friends.push({ id: p.id, username: p.username ?? null, display_name: p.display_name ?? "", rating: p.rating ?? 1500 });
    });
    incoming.forEach((r) => {
      const p = byId.get(r.from_user_id);
      if (p)
        pendingIncoming.push({
          id: r.id,
          from_user: { id: p.id, username: p.username ?? null, display_name: p.display_name ?? "", rating: p.rating ?? 1500 }
        });
    });
    outgoing.forEach((r) => {
      const p = byId.get(r.to_user_id);
      if (p)
        pendingOutgoing.push({
          id: r.id,
          to_user: { id: p.id, username: p.username ?? null, display_name: p.display_name ?? "", rating: p.rating ?? 1500 }
        });
    });
  }

  return NextResponse.json({ friends, pending_incoming: pendingIncoming, pending_outgoing: pendingOutgoing });
}

/** POST: отправить заявку в друзья (body: { username }) */
export async function POST(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
  const me = auth.user.id;

  let body: { username?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Укажите логин пользователя" }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  if (!username) {
    return NextResponse.json({ error: "Укажите логин пользователя" }, { status: 400 });
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (!target || target.id === me) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("friend_requests")
    .select("id, status")
    .eq("from_user_id", me)
    .eq("to_user_id", target.id)
    .maybeSingle();
  if (existing) {
    if (existing.status === "accepted") return NextResponse.json({ error: "Вы уже друзья" }, { status: 400 });
    if (existing.status === "pending") return NextResponse.json({ error: "Заявка уже отправлена" }, { status: 400 });
  }

  const { data: reverse } = await supabase
    .from("friend_requests")
    .select("id, status")
    .eq("from_user_id", target.id)
    .eq("to_user_id", me)
    .maybeSingle();
  if (reverse?.status === "pending") {
    return NextResponse.json({ error: "У вас уже есть входящая заявка от этого пользователя. Примите её во вкладке «Друзья»." }, { status: 400 });
  }
  if (reverse?.status === "accepted") return NextResponse.json({ error: "Вы уже друзья" }, { status: 400 });

  const { error: insertErr } = await supabase.from("friend_requests").insert({
    from_user_id: me,
    to_user_id: target.id,
    status: "pending"
  });
  if (insertErr) {
    console.error("Friend request insert:", insertErr);
    return NextResponse.json({ error: "Не удалось отправить заявку" }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
