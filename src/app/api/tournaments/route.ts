import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

export async function GET() {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("tournaments")
    .select("id, title, status, format, created_at, max_players, starts_at, created_by")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tournaments: data ?? [] });
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

  const format = body.format === "swiss" ? "swiss" : "round_robin";
  const maxPlayers = typeof body.max_players === "number" && body.max_players > 0 ? body.max_players : null;
  const startsAt = body.starts_at ? new Date(body.starts_at).toISOString() : null;

  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      title,
      status: "open",
      format,
      created_by: user.id,
      max_players: maxPlayers,
      starts_at: startsAt
    })
    .select("id, title, status, format, created_at, max_players, starts_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
