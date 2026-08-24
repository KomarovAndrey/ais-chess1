import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clocksAreRunning } from "@/lib/clocks";
import { syncActiveGameClocks } from "@/lib/games/syncClocks";

const PlayGame = dynamic(() => import("./play-game"), {
  ssr: true,
  loading: () => (
    <div className="flex min-h-[50vh] items-center justify-center text-white/45">
      Загрузка партии…
    </div>
  ),
});

interface PlayPageProps {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ watch?: string }>;
}

export default async function PlayPage({ params, searchParams }: PlayPageProps) {
  const { gameId } = await params;
  const sp = await searchParams;
  const watch = sp.watch === "1" || sp.watch === "true";

  const supabase = await createClient();
  if (!supabase) {
    notFound();
  }

  const { data: game, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (error || !game) {
    notFound();
  }

  // Wall-clock sync on load: flag falls even if both players had closed the tab.
  let initialGame = game;
  const admin = createAdminClient();
  if (admin && game.status === "active") {
    try {
      const synced = await syncActiveGameClocks(admin, game);
      const moves = Array.isArray(synced.game.moves)
        ? (synced.game.moves as string[])
        : [];
      const dbLast = (game as { last_move_at?: string | null }).last_move_at ?? null;
      const running =
        synced.game.status === "active" &&
        !synced.timedOut &&
        clocksAreRunning(moves, dbLast);
      initialGame = {
        ...synced.game,
        white_time_left: synced.whiteTimeLeft,
        black_time_left: synced.blackTimeLeft,
        last_move_at: running ? new Date().toISOString() : synced.game.last_move_at,
      };
    } catch (e) {
      console.error("play page clock sync:", e);
    }
  }

  return <PlayGame initialGame={initialGame} forceWatch={watch} />;
}
