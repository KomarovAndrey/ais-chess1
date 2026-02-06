import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabaseServer";
import PlayGame from "./play-game";

interface PlayPageProps {
  params: Promise<{ gameId: string }>;
}

export default async function PlayPage({ params }: PlayPageProps) {
  const { gameId } = await params;

  const supabase = getSupabaseServer();
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

  return <PlayGame initialGame={game} />;
}

