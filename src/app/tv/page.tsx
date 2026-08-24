"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tv } from "lucide-react";
import { formatTimeControl } from "@/lib/timeControls";

type LiveGame = {
  id: string;
  time_control_seconds: number;
  increment_seconds: number | null;
  rated: boolean | null;
  white: { username: string | null; rating: number | null };
  black: { username: string | null; rating: number | null };
  last_move_at: string | null;
};

export default function TvPage() {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/tv");
      const data = await res.json().catch(() => null);
      if (!cancelled && Array.isArray(data?.games)) {
        setGames(data.games);
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    const t = setInterval(() => void load(), 10000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  function nameOf(p: { username: string | null; rating: number | null }) {
    const n = p.username ?? "Гость";
    return `${n} (${p.rating ?? 1500})`;
  }

  return (
    <main className="page-bg min-h-screen px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-white/55 transition hover:text-white">
            ← На главную
          </Link>
          <h1 className="flex items-center gap-2 font-display text-xl font-semibold text-white">
            <Tv className="h-6 w-6 text-gold" />
            Сейчас играют
          </h1>
        </div>

        <p className="mb-4 text-sm text-white/55">
          Смотрите живые партии. Откройте трансляцию — доска только для просмотра.
        </p>

        {loading ? (
          <p className="text-sm text-white/45">Загрузка…</p>
        ) : games.length === 0 ? (
          <div className="surface p-6 text-center text-sm text-white/55">
            Сейчас нет активных партий. Загляните позже или{" "}
            <Link href="/" className="text-gold hover:underline">
              найдите игру
            </Link>
            .
          </div>
        ) : (
          <ul className="space-y-3">
            {games.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/play/${g.id}?watch=1`}
                  className="surface block p-4 transition hover:border-gold/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {nameOf(g.white)}
                        <span className="mx-2 text-white/35">vs</span>
                        {nameOf(g.black)}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        {formatTimeControl(
                          g.time_control_seconds,
                          g.increment_seconds ?? 0
                        )}
                        {g.rated === false ? " · товарищеская" : " · рейтинговая"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300">
                      Смотреть
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
