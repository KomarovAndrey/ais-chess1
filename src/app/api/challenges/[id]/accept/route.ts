import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { id: challengeId } = await params;
  if (!UUID_REGEX.test(challengeId)) {
    return NextResponse.json({ error: "Invalid challenge id" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("accept_game_challenge", {
    p_challenge_id: challengeId
  });

  if (error) {
    // Ошибки из raise exception
    const msg = (error as any)?.message ?? "Не удалось принять вызов";
    const friendly =
      typeof msg === "string" && msg.includes("challenge_not_pending")
        ? "Вызов уже неактуален"
        : typeof msg === "string" && msg.includes("forbidden")
          ? "Нельзя принять чужой вызов"
          : typeof msg === "string" && msg.includes("challenge_not_found")
            ? "Вызов не найден"
            : "Не удалось принять вызов";
    console.error("Challenge accept error:", error);
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  const gameId = typeof data === "string" ? data : null;
  if (!gameId) {
    return NextResponse.json({ error: "Не удалось создать партию" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, gameId });
}

