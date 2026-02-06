import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PlayGame from "./play-game";

interface PlayPageProps {
  params: { gameId: string };
}

export default async function PlayPage({ params }: PlayPageProps) {
  const { gameId } = params;

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

