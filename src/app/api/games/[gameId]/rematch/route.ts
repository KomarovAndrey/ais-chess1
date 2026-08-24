import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  findPlayer,
  getGameWriteClient,
  SERVICE_ROLE_MISSING,
  type GamePlayerRow,
} from "@/lib/games/integrity";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Rematch flow on a finished game:
 * - First call: set rematch_offer_from
 * - Second call by opponent: create new active game (colors swapped), return gameId
 * - Same player calling again: no-op / return current offer
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;
  const writeClient = getGameWriteClient(supabase);
  if (!writeClient) {
    return NextResponse.json(SERVICE_ROLE_MISSING, { status: 503 });
  }
  const me = user.id;

  if (!await checkRateLimit(me)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { gameId } = await params;
  if (!UUID_REGEX.test(gameId)) {
    return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  }

  const { data: game, error: gameError } = await writeClient
    .from("games")
    .select(
      "id, status, time_control_seconds, increment_seconds, rated, rematch_offer_from"
    )
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (game.status !== "finished") {
    return NextResponse.json(
      { error: "Реванш доступен только после партии" },
      { status: 400 }
    );
  }

  const { data: players } = await writeClient
    .from("game_players")
    .select("player_id, side")
    .eq("game_id", gameId);

  const meRow = findPlayer(players as GamePlayerRow[] | null, me);
  if (!meRow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const opponent = (players as GamePlayerRow[] | null)?.find(
    (p) => p.player_id !== me
  );
  if (!opponent?.player_id) {
    return NextResponse.json({ error: "Нет соперника для реванша" }, { status: 400 });
  }

  const offerFrom = game.rematch_offer_from as string | null;

  // Accept opponent's offer → create rematch game
  if (offerFrom && offerFrom === opponent.player_id) {
    const time = game.time_control_seconds ?? 300;
    const inc = game.increment_seconds ?? 0;
    const rated = game.rated !== false;
    const initial = time * 1000;
    const now = new Date().toISOString();

    // Swap colors vs original
    const origWhite = (players as GamePlayerRow[]).find((p) => p.side === "white");
    const origBlack = (players as GamePlayerRow[]).find((p) => p.side === "black");
    const newWhite = origBlack?.player_id ?? me;
    const newBlack = origWhite?.player_id ?? opponent.player_id;

    const { data: newGame, error: createErr } = await writeClient
      .from("games")
      .insert({
        status: "active",
        fen: "startpos",
        creator_color: "random",
        time_control_seconds: time,
        increment_seconds: inc,
        rated,
        active_color: "w",
        started_at: now,
        white_time_left: initial,
        black_time_left: initial,
        // Clocks start after White's first move (Lichess).
        last_move_at: null,
      })
      .select("*")
      .single();

    if (createErr || !newGame) {
      console.error("rematch create:", createErr);
      return NextResponse.json({ error: "Не удалось создать реванш" }, { status: 500 });
    }

    const { error: seatsErr } = await writeClient.from("game_players").insert([
      { game_id: newGame.id, side: "white", player_id: newWhite },
      { game_id: newGame.id, side: "black", player_id: newBlack },
    ]);

    if (seatsErr) {
      console.error("rematch seats:", seatsErr);
      return NextResponse.json({ error: "Не удалось посадить игроков" }, { status: 500 });
    }

    await writeClient
      .from("games")
      .update({ rematch_offer_from: null, rematch_game_id: newGame.id })
      .eq("id", gameId);

    return NextResponse.json({
      ok: true,
      accepted: true,
      gameId: newGame.id,
      url: `/play/${newGame.id}`,
    });
  }

  // Already offered by me
  if (offerFrom === me) {
    return NextResponse.json({ ok: true, offered: true, waiting: true });
  }

  // Create offer
  const { error: offerErr } = await writeClient
    .from("games")
    .update({ rematch_offer_from: me })
    .eq("id", gameId)
    .eq("status", "finished");

  if (offerErr) {
    // Column may be missing until migration
    console.error("rematch offer:", offerErr);
    return NextResponse.json(
      { error: "Не удалось предложить реванш. Выполните SQL миграцию matchmaking." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, offered: true, waiting: true });
}
