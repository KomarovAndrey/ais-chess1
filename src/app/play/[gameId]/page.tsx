import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const PlayGame = dynamic(() => import("./play-game"), {
  ssr: true,
  loading: () => (
    <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
      Загрузка партии…
    </div>
  ),
});

interface PlayPageProps {
  params: Promise<{ gameId: string }>;
}

export default async function PlayPage({ params }: PlayPageProps) {
  const { gameId } = await params;

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

  return <PlayGame initialGame={game} />;
}

