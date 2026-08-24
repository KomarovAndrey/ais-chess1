import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  return <PlayGame initialGame={game} forceWatch={watch} />;
}
