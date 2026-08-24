import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { TIME_PRESETS } from "@/lib/timeControls";

export async function GET() {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("tournaments")
    .select(
      "id, title, status, format, created_at, max_players, starts_at, ends_at, created_by, time_control_seconds, increment_seconds, rated, duration_minutes"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Refresh statuses for open/started arenas
  const list = data ?? [];
  for (const t of list) {
    if (t.format === "arena" && t.status !== "finished") {
      await supabase.rpc("refresh_tournament_status", { p_id: t.id });
    }
  }

  const { data: refreshed } = await supabase
    .from("tournaments")
    .select(
      "id, title, status, format, created_at, max_players, starts_at, ends_at, created_by, time_control_seconds, increment_seconds, rated, duration_minutes"
    )
    .order("created_at", { ascending: false });

  return NextResponse.json({ tournaments: refreshed ?? list });
}

export async function POST(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Укажите название турнира." }, { status: 400 });
  }

  const format =
    body.format === "swiss" || body.format === "round_robin" ? body.format : "arena";

  const timeControlSeconds =
    typeof body.timeControlSeconds === "number" ? body.timeControlSeconds : 300;
  const incrementSeconds =
    typeof body.incrementSeconds === "number" ? body.incrementSeconds : 0;
  const durationMinutes =
    typeof body.durationMinutes === "number" && body.durationMinutes >= 10
      ? Math.min(body.durationMinutes, 360)
      : 60;
  const rated = body.rated !== false;
  const maxPlayers =
    typeof body.max_players === "number" && body.max_players > 0
      ? body.max_players
      : null;

  const known = TIME_PRESETS.some(
    (p) => p.seconds === timeControlSeconds && p.increment === incrementSeconds
  );
  if (!known && (timeControlSeconds < 60 || timeControlSeconds > 1800)) {
    return NextResponse.json({ error: "Некорректный контроль времени" }, { status: 400 });
  }

  const now = new Date();
  const startsAt = body.starts_at ? new Date(body.starts_at) : now;
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  const insertPayload: Record<string, unknown> = {
    title,
    status: startsAt.getTime() <= Date.now() ? "started" : "open",
    format,
    created_by: user.id,
    max_players: maxPlayers,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    time_control_seconds: timeControlSeconds,
    increment_seconds: incrementSeconds,
    rated,
    duration_minutes: durationMinutes,
  };

  let { data, error } = await supabase
    .from("tournaments")
    .insert(insertPayload)
    .select(
      "id, title, status, format, created_at, max_players, starts_at, ends_at, time_control_seconds, increment_seconds, rated, duration_minutes"
    )
    .single();

  // Fallback if arena columns missing
  if (error && error.message?.includes("time_control_seconds")) {
    const legacy = {
      title,
      status: "open",
      format: format === "arena" ? "round_robin" : format,
      created_by: user.id,
      max_players: maxPlayers,
      starts_at: startsAt.toISOString(),
    };
    const retry = await supabase
      .from("tournaments")
      .insert(legacy)
      .select("id, title, status, format, created_at, max_players, starts_at")
      .single();
    data = retry.data as typeof data;
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
