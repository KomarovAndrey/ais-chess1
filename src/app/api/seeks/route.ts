import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { toLobbySeekCard, type LobbySeekRow } from "@/lib/lobby";
import { acceptSeekSchema, createSeekSchema } from "@/lib/validations/games";

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  rating: number | null;
  rating_bullet: number | null;
  rating_blitz: number | null;
  rating_rapid: number | null;
};

/** GET: own seek, or ?lobby=1 for pending lobby seeks with player cards */
export async function GET(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const lobby = req.nextUrl.searchParams.get("lobby") === "1";

  if (lobby) {
    const { data: rows, error } = await supabase
      .from("game_seeks")
      .select(
        "id, user_id, status, time_control_seconds, increment_seconds, rated, color, created_at, tournament_id"
      )
      .eq("status", "pending")
      .is("tournament_id", null)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error("GET /api/seeks?lobby=1:", error);
      return NextResponse.json(
        {
          error:
            "Не удалось загрузить лобби. Выполните SQL supabase-migration-wave-3-live-lobby.sql",
          seeks: [],
        },
        { status: 500 }
      );
    }

    const seekRows = (rows ?? []) as LobbySeekRow[];
    const userIds = [...new Set(seekRows.map((r) => r.user_id))];
    let profilesById = new Map<string, ProfileRow>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, rating, rating_bullet, rating_blitz, rating_rapid"
        )
        .in("id", userIds);
      profilesById = new Map(
        ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p])
      );
    }

    const seeks = seekRows.map((row) =>
      toLobbySeekCard(row, profilesById.get(row.user_id))
    );
    return NextResponse.json({ seeks });
  }

  const { data, error } = await supabase
    .from("game_seeks")
    .select(
      "id, status, time_control_seconds, increment_seconds, rated, color, game_id, created_at, matched_at"
    )
    .eq("user_id", user.id)
    .in("status", ["pending", "matched"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("GET /api/seeks:", error);
    return NextResponse.json({ error: "Failed to load seek" }, { status: 500 });
  }

  return NextResponse.json({ seek: data ?? null });
}

/** POST: match-or-create seek, or acceptSeekId for a specific lobby seek. */
export async function POST(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  if (!(await checkRateLimit(user.id))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const acceptParsed = acceptSeekSchema.safeParse(body);
  if (acceptParsed.success) {
    const { data, error } = await supabase.rpc("accept_seek", {
      p_seek_id: acceptParsed.data.acceptSeekId,
    });

    if (error) {
      const msg = error.message || "";
      if (msg.includes("profile_required")) {
        return NextResponse.json(
          { error: "Для рейтинговой игры нужен профиль. Завершите регистрацию." },
          { status: 400 }
        );
      }
      if (msg.includes("seek_not_found") || msg.includes("seek_not_pending")) {
        return NextResponse.json(
          { error: "Этот вызов уже недоступен." },
          { status: 409 }
        );
      }
      if (msg.includes("cannot_accept_own_seek")) {
        return NextResponse.json(
          { error: "Нельзя принять собственный поиск." },
          { status: 400 }
        );
      }
      console.error("accept_seek:", error);
      return NextResponse.json(
        {
          error:
            "Не удалось принять вызов. Выполните SQL supabase-migration-wave-3-live-lobby.sql",
        },
        { status: 500 }
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    const seekId = row?.seek_id ?? null;
    const gameId = row?.game_id ?? null;
    if (!gameId) {
      return NextResponse.json(
        { error: "Вызов не создал партию." },
        { status: 500 }
      );
    }
    return NextResponse.json({
      seekId,
      gameId,
      url: `/play/${gameId}`,
      status: "matched",
    });
  }

  const parsed = createSeekSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const message = Object.values(first).flat().join(" ") || "Validation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const {
    creatorColor,
    timeControlSeconds,
    incrementSeconds = 0,
    rated = true,
    tournamentId = null,
  } = parsed.data;

  const { data, error } = await supabase.rpc("match_or_create_seek", {
    p_time: timeControlSeconds,
    p_increment: incrementSeconds,
    p_rated: rated,
    p_color: creatorColor,
    p_tournament_id: tournamentId,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("profile_required")) {
      return NextResponse.json(
        { error: "Для рейтинговой игры нужен профиль. Завершите регистрацию." },
        { status: 400 }
      );
    }
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
    console.error("match_or_create_seek:", error);
    return NextResponse.json(
      { error: "Не удалось найти партию. Выполните SQL миграцию matchmaking/arena." },
      { status: 500 }
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  const seekId = row?.seek_id ?? null;
  const gameId = row?.game_id ?? null;

  return NextResponse.json(
    {
      seekId,
      gameId,
      url: gameId ? `/play/${gameId}` : null,
      status: gameId ? "matched" : "searching",
    },
    { status: gameId ? 200 : 201 }
  );
}

/** DELETE: cancel pending seek (optional body { seekId }) */
export async function DELETE(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  let seekId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.seekId === "string") seekId = body.seekId;
  } catch {
    /* empty */
  }

  let q = supabase
    .from("game_seeks")
    .update({ status: "cancelled" })
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (seekId) q = q.eq("id", seekId);

  const { error } = await q;
  if (error) {
    console.error("DELETE /api/seeks:", error);
    return NextResponse.json({ error: "Failed to cancel seek" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
