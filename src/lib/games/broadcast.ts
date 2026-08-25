/**
 * Server-side Realtime broadcast for live games (Wave 3).
 * Publishes authoritative game state so opponents/spectators do not rely
 * on the mover's browser to call channel.send().
 */

export type GameBroadcastEvent = "move" | "game";

export function gameChannelTopic(gameId: string): string {
  return `game:${gameId}`;
}

/**
 * POST to Supabase Realtime REST broadcast API.
 * Returns false (and never throws) when env is missing or the request fails —
 * postgres_changes + polling remain the safety net.
 */
export async function broadcastGameUpdate(
  gameId: string,
  game: unknown,
  event: GameBroadcastEvent = "move"
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !gameId) return false;

  const endpoint = `${url.replace(/\/$/, "")}/realtime/v1/api/broadcast`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: gameChannelTopic(gameId),
            event,
            payload: { game },
          },
        ],
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("broadcastGameUpdate failed:", err);
    return false;
  }
}

/** Fire-and-forget wrapper for API routes (does not block the response path long). */
export function voidBroadcastGameUpdate(
  gameId: string,
  game: unknown,
  event: GameBroadcastEvent = "move"
): void {
  void broadcastGameUpdate(gameId, game, event);
}
