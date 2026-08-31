import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Withdraw from tournament (keep score history). */
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

  const { error } = await supabase
    .from("tournament_players")
    .update({ withdrawn: true })
    .eq("tournament_id", id)
    .eq("user_id", user.id);

  if (error) {
    // Fallback: delete row if withdrawn column missing
    if (error.message?.includes("withdrawn")) {
      const del = await supabase
        .from("tournament_players")
        .delete()
        .eq("tournament_id", id)
        .eq("user_id", user.id);
      if (del.error) {
        return NextResponse.json({ error: del.error.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  await supabase.rpc("arena_leave_pairing", { p_tournament_id: id });

  await supabase
    .from("game_seeks")
    .update({ status: "cancelled" })
    .eq("user_id", user.id)
    .eq("tournament_id", id)
    .eq("status", "pending");

  return NextResponse.json({ ok: true });
}
