import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ChallengeRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  creator_color: "white" | "black" | "random";
  time_control_seconds: number;
  created_at: string;
  game_id: string | null;
};

/** GET: вызовы на партию (pending). scope=incoming|outgoing (по умолчанию incoming) */
export async function GET(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
  const me = auth.user.id;

  const scope = req.nextUrl.searchParams.get("scope") ?? "incoming";
  const isOutgoing = scope === "outgoing";

  const baseQuery = supabase
    .from("game_challenges")
    .select("id, from_user_id, to_user_id, status, creator_color, time_control_seconds, created_at, game_id")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: rows, error } = isOutgoing
    ? await baseQuery.eq("from_user_id", me)
    : await baseQuery.eq("to_user_id", me);

  if (error) {
    console.error("Challenges load error:", error);
    return NextResponse.json({ error: "Failed to load challenges" }, { status: 500 });
  }

  const otherIds = Array.from(
    new Set(
      (rows ?? []).map((r: ChallengeRow) => (isOutgoing ? r.to_user_id : r.from_user_id))
    )
  );
  const { data: profiles } =
    otherIds.length > 0
      ? await supabase.from("profiles").select("id, username, display_name, rating, rating_blitz").in("id", otherIds)
      : { data: [] as any[] };

  const byId = new Map(
    (profiles ?? []).map(
      (p: { id: string; username: string | null; display_name: string | null; rating?: number | null; rating_blitz?: number | null }) => [
        p.id,
        {
          id: p.id,
          username: p.username ?? null,
          display_name: p.display_name ?? p.username ?? "Игрок",
          rating: (p.rating_blitz ?? p.rating) ?? 1500
        }
      ]
    )
  );

  if (isOutgoing) {
    const outgoing = (rows ?? []).map((r: ChallengeRow) => ({
      id: r.id,
      to_user: byId.get(r.to_user_id) ?? { id: r.to_user_id, username: null, display_name: "Игрок", rating: 1500 },
      creator_color: r.creator_color,
      time_control_seconds: r.time_control_seconds,
      created_at: r.created_at
    }));
    return NextResponse.json({ outgoing });
  }

  const incoming = (rows ?? []).map((r: ChallengeRow) => ({
    id: r.id,
    from_user: byId.get(r.from_user_id) ?? { id: r.from_user_id, username: null, display_name: "Игрок", rating: 1500 },
    creator_color: r.creator_color,
    time_control_seconds: r.time_control_seconds,
    created_at: r.created_at
  }));

  return NextResponse.json({ incoming });
}

/** POST: создать вызов другу (body: { toUserId, creatorColor, timeControlSeconds }) */
export async function POST(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
  const me = auth.user.id;

  let body: {
    toUserId?: string;
    creatorColor?: "white" | "black" | "random";
    timeControlSeconds?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const toUserId = typeof body.toUserId === "string" ? body.toUserId : "";
  if (!UUID_REGEX.test(toUserId) || toUserId === me) {
    return NextResponse.json({ error: "Некорректный игрок" }, { status: 400 });
  }

  const creatorColor = body.creatorColor ?? "random";
  if (!["white", "black", "random"].includes(creatorColor)) {
    return NextResponse.json({ error: "Некорректный цвет" }, { status: 400 });
  }

  const timeControlSeconds =
    typeof body.timeControlSeconds === "number" && Number.isFinite(body.timeControlSeconds)
      ? Math.floor(body.timeControlSeconds)
      : 300;
  if (timeControlSeconds < 1 || timeControlSeconds > 86400) {
    return NextResponse.json({ error: "Некорректный контроль времени" }, { status: 400 });
  }

  // Разрешаем вызывать только друзей (accepted)
  const { data: friendsRows } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(from_user_id.eq.${me},to_user_id.eq.${toUserId}),and(from_user_id.eq.${toUserId},to_user_id.eq.${me})`
    );
  if (!friendsRows || friendsRows.length === 0) {
    return NextResponse.json({ error: "Можно вызывать на партию только друзей" }, { status: 403 });
  }

  // Если уже есть pending-вызов — вернём его id (чтобы можно было показать "Отменить вызов")
  const { data: existing } = await supabase
    .from("game_challenges")
    .select("id")
    .eq("from_user_id", me)
    .eq("to_user_id", toUserId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing?.id) {
    return NextResponse.json({ ok: true, challengeId: existing.id, alreadyPending: true }, { status: 200 });
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("game_challenges")
    .insert({
      from_user_id: me,
      to_user_id: toUserId,
      status: "pending",
      creator_color: creatorColor,
      time_control_seconds: timeControlSeconds
    })
    .select("id")
    .single();

  if (insertErr) {
    // Частый кейс: уже есть pending (partial unique index)
    const message =
      typeof insertErr.message === "string" && insertErr.message.toLowerCase().includes("duplicate")
        ? "Уже есть активный вызов этому другу"
        : "Не удалось отправить вызов";
    console.error("Challenge insert error:", insertErr);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, challengeId: inserted?.id }, { status: 201 });
}

