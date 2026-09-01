import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
      <main className="page-bg flex min-h-screen items-center justify-center">
        <p className="text-white/55">Неверная ссылка на игру.</p>
      </main>
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return (
      <main className="page-bg flex min-h-screen items-center justify-center">
        <p className="text-white/55">Сервис недоступен.</p>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/reversi/play/${gameId}`);
  }

  const { data } = await supabase
    .from("reversi_games")
    .select("id, status, board, turn, winner, moves, black_player_id, white_player_id")
    .eq("id", gameId)
    .single();

  const initialGame = data as {
    id: string;
    status: string;
    board: unknown;
    turn: string;
    winner: string | null;
    moves?: { row: number; col: number; player: "black" | "white" }[];
  } | null;

  return (
    <main className="page-bg min-h-screen">
      <ReversiPlayClient gameId={gameId} initialGame={initialGame} />
    </main>
  );
}
