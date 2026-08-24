import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser, getSupabaseOptionalUser } from "@/lib/apiAuth";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** GET: recent chat messages for a game (players + spectators). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const auth = await getSupabaseOptionalUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { gameId } = await params;
  if (!UUID_REGEX.test(gameId)) {
    return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("game_messages")
    .select("id, user_id, body, created_at")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    if (error.message?.includes("game_messages") || error.code === "42P01") {
      return NextResponse.json({ messages: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const userIds = Array.from(new Set(rows.map((m) => m.user_id)));
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      names.set(
        p.id,
        (p.username || p.display_name || "Игрок").toString()
      );
    }
  }

  return NextResponse.json({
    messages: rows.map((m) => ({
      id: m.id,
      userId: m.user_id,
      username: names.get(m.user_id) ?? "Игрок",
      body: m.body,
      createdAt: m.created_at,
    })),
  });
}

/** POST: send a chat message (auth required). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const { gameId } = await params;
  if (!UUID_REGEX.test(gameId)) {
    return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text || text.length > 280) {
    return NextResponse.json(
      { error: "Сообщение: 1–280 символов" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("game_messages")
    .insert({ game_id: gameId, user_id: user.id, body: text })
    .select("id, user_id, body, created_at")
    .single();

  if (error) {
    if (error.message?.includes("game_messages") || error.code === "42P01") {
      return NextResponse.json(
        { error: "Чат недоступен. Выполните SQL миграцию Phase F." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json(
    {
      message: {
        id: data.id,
        userId: data.user_id,
        username: profile?.username || profile?.display_name || "Игрок",
        body: data.body,
        createdAt: data.created_at,
      },
    },
    { status: 201 }
  );
}
