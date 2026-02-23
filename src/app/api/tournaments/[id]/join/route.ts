import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid tournament id" }, { status: 400 });
  }

  const { data: tournament, error: tError } = await supabase
    .from("tournaments")
    .select("id, status, max_players")
    .eq("id", id)
    .single();

  if (tError || !tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  if (tournament.status !== "open") {
    return NextResponse.json({ error: "Запись в турнир закрыта." }, { status: 400 });
  }

  const { count } = await supabase
    .from("tournament_players")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", id);

  if (tournament.max_players != null && (count ?? 0) >= tournament.max_players) {
    return NextResponse.json({ error: "Достигнут лимит участников." }, { status: 400 });
  }

  const { error: insertError } = await supabase
    .from("tournament_players")
    .insert({ tournament_id: id, user_id: user.id });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "Вы уже записаны в этот турнир." }, { status: 400 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
