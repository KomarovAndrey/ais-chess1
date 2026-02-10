import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseOptionalUser } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { joinGameSchema } from "@/lib/validations/games";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PlayerInfo = { username: string | null; rating: number | null };

function ratingCategoryFromTimeControlSeconds(t: number | null | undefined): "bullet" | "blitz" | "rapid" {
  const v = typeof t === "number" && Number.isFinite(t) ? t : 300;
  if (v <= 120) return "bullet";
  if (v <= 300) return "blitz";
  return "rapid";
}

async function getPlayersInfo(
  supabase: SupabaseClient,
  gamePlayers: { side: string; player_id: string }[],
  category: "bullet" | "blitz" | "rapid"
): Promise<{ whitePlayer: PlayerInfo; blackPlayer: PlayerInfo }> {
  const empty: PlayerInfo = { username: null, rating: null };
  const white = gamePlayers.find((p) => p.side === "white");
  const black = gamePlayers.find((p) => p.side === "black");
  const ids = [white?.player_id, black?.player_id].filter(Boolean) as string[];
  if (ids.length === 0) {
    return { whitePlayer: empty, blackPlayer: empty };
  }
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, rating, rating_bullet, rating_blitz, rating_rapid")
    .in("id", ids);
  const pick = (r: any) => {
    const base = r?.rating ?? 1500;
    if (category === "bullet") return r?.rating_bullet ?? base;
    if (category === "blitz") return r?.rating_blitz ?? base;
    return r?.rating_rapid ?? base;
  };
  const byId = new Map(
    (profiles ?? []).map((r: { id: string; username: string | null }) => [
      r.id,
      { username: (r as any).username ?? null, rating: pick(r) }
    ])
  );
  return {
    whitePlayer: white ? byId.get(white.player_id) ?? empty : empty,
    blackPlayer: black ? byId.get(black.player_id) ?? empty : empty
  };
}

export async function POST(req: NextRequest) {
  const auth = await getSupabaseOptionalUser();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  try {
    const body = await req.json();
    const parsed = joinGameSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const message = Object.values(first).flat().join(" ") || "Validation failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { gameId, playerId: bodyPlayerId } = parsed.data;
    const playerId = user?.id ?? bodyPlayerId;
    if (!playerId || (user === null && (!bodyPlayerId || !UUID_REGEX.test(bodyPlayerId)))) {
      return NextResponse.json(
        { error: "Для игры без входа укажите playerId (UUID) в теле запроса." },
        { status: 400 }
      );
    }

    if (!checkRateLimit(playerId)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    const { data: players, error: playersError } = await supabase
      .from("game_players")
      .select("*")
      .eq("game_id", gameId);

    if (playersError) {
      console.error("Error loading players:", playersError);
      return NextResponse.json(
        { error: "Failed to load players" },
        { status: 500 }
      );
    }

    const existing = players?.find((p: { player_id: string }) => p.player_id === playerId);
    if (existing) {
      const category = ratingCategoryFromTimeControlSeconds(game.time_control_seconds);
      const { whitePlayer, blackPlayer } = await getPlayersInfo(supabase, players ?? [], category);
      return NextResponse.json(
        { game, player: existing, whitePlayer, blackPlayer },
        { status: 200 }
      );
    }

    if (game.status !== "waiting") {
      return NextResponse.json(
        { error: "Game is not accepting joins" },
        { status: 400 }
      );
    }

    const hasWhite = players?.some((p: { side: string }) => p.side === "white");
    const hasBlack = players?.some((p: { side: string }) => p.side === "black");

    if (hasWhite && hasBlack) {
      return NextResponse.json(
        { error: "Game is full" },
        { status: 400 }
      );
    }

    let side: "white" | "black";
    if (!hasWhite && !hasBlack) {
      if (game.creator_color === "white") side = "white";
      else if (game.creator_color === "black") side = "black";
      else side = Math.random() < 0.5 ? "white" : "black";
    } else if (!hasWhite) {
      side = "white";
    } else {
      side = "black";
    }

    const { data: player, error: insertError } = await supabase
      .from("game_players")
      .insert({
        game_id: gameId,
        side,
        player_id: playerId
      })
      .select("*")
      .single();

    if (insertError || !player) {
      console.error("Error creating player:", insertError);
      return NextResponse.json(
        { error: "Failed to join game" },
        { status: 500 }
      );
    }

    const totalPlayers = (players?.length ?? 0) + 1;
    if (totalPlayers >= 2 && game.status === "waiting") {
      await supabase
        .from("games")
        .update({
          status: "active",
          started_at: new Date().toISOString(),
          last_move_at: new Date().toISOString()
        })
        .eq("id", gameId);
    }

    const allPlayers = [...(players ?? []), player];
    const category = ratingCategoryFromTimeControlSeconds(game.time_control_seconds);
    const { whitePlayer, blackPlayer } = await getPlayersInfo(supabase, allPlayers, category);

    return NextResponse.json(
      {
        game: {
          ...game,
          status:
            totalPlayers >= 2 && game.status === "waiting"
              ? "active"
              : game.status
        },
        player,
        whitePlayer,
        blackPlayer
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/games/join:", error);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
