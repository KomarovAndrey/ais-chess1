import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** POST: enter Arena pairing pool (auto-pair idle players + seek fallback). */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  if (!(await checkRateLimit(user.id))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid tournament id" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("arena_enter_pairing", {
    p_tournament_id: id,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("tournament_not_active")) {
      return NextResponse.json(
        { error: "Турнир не идёт или уже завершён." },
        { status: 400 }
      );
    }
    if (msg.includes("not_in_tournament")) {
      return NextResponse.json(
        { error: "Сначала запишитесь в турнир." },
        { status: 400 }
      );
    }
    console.error("arena_enter_pairing:", error);
    return NextResponse.json(
      {
        error:
          "Не удалось войти в паринг. Выполните SQL supabase-migration-tournaments-arena-autopair.sql",
      },
      { status: 500 }
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  const gameId = row?.game_id ?? null;
  const status = row?.status ?? "waiting";

  return NextResponse.json({
    gameId,
    status,
    url: gameId ? `/play/${gameId}` : null,
  });
}

/** DELETE: leave pairing pool and cancel tournament seek. */
export async function DELETE(
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

  const { error } = await supabase.rpc("arena_leave_pairing", {
    p_tournament_id: id,
  });

  if (error) {
    console.error("arena_leave_pairing:", error);
    return NextResponse.json({ error: "Failed to leave pairing" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
