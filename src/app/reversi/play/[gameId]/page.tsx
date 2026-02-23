import { getAnonSupabase } from "@/lib/supabase/anon-server";
import ReversiPlayClient from "./reversi-play-client";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ReversiPlayPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  if (!UUID_REGEX.test(gameId)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-50 to-emerald-50">
        <p className="text-slate-600">Неверная ссылка на игру.</p>
      </main>
    );
  }

  const supabase = getAnonSupabase();
  let initialGame: { id: string; status: string; board: unknown; turn: string; winner: string | null } | null = null;
  if (supabase) {
    const { data } = await supabase
      .from("reversi_games")
      .select("id, status, board, turn, winner")
      .eq("id", gameId)
      .single();
    initialGame = data as typeof initialGame;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 via-white to-emerald-50">
      <ReversiPlayClient gameId={gameId} initialGame={initialGame} />
    </main>
  );
}
