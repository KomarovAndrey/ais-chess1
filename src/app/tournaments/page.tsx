"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trophy, Plus, Calendar } from "lucide-react";

type Tournament = {
  id: string;
  title: string;
  status: string;
  format: string;
  created_at: string;
  max_players: number | null;
  starts_at: string | null;
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tournaments")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.tournaments)) setTournaments(data.tournaments);
      })
      .catch(() => setTournaments([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось создать турнир");
      setTournaments((prev) => [{ ...data, created_at: data.created_at ?? new Date().toISOString() }, ...prev]);
      setTitle("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setCreating(false);
    }
  }

  const statusLabel = (s: string) => (s === "open" ? "Запись открыта" : s === "started" ? "Идёт" : "Завершён");

  return (
    <main className="page-bg min-h-screen px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-white/55 transition hover:text-white">
            ← На главную
          </Link>
          <h1 className="flex items-center gap-2 font-display text-xl font-semibold text-white">
            <Trophy className="h-6 w-6 text-gold" />
            Турниры
          </h1>
        </div>

        <div className="mb-6 surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Создать турнир</h2>
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название турнира"
              className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-sm outline-none focus:border-gold/50"
            />
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white hover:bg-gold-bright disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Создать
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        </div>

        {loading ? (
          <p className="text-center text-white/45">Загрузка...</p>
        ) : tournaments.length === 0 ? (
          <p className="text-center text-white/45">
            Пока нет турниров или требуется войти в аккаунт. Создайте турнир или войдите.
          </p>
        ) : (
          <ul className="space-y-3">
            {tournaments.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tournaments/${t.id}`}
                  className="flex items-center justify-between surface p-4 transition hover:border-gold/40 hover:bg-white/[0.07]"
                >
                  <div>
                    <p className="font-semibold text-white">{t.title}</p>
                    <p className="text-xs text-white/45">
                      {statusLabel(t.status)} · {t.format === "swiss" ? "Швейцарка" : "Круговая"}
                      {t.starts_at && (
                        <> · <Calendar className="inline h-3 w-3" /> {new Date(t.starts_at).toLocaleDateString("ru")}</>
                      )}
                    </p>
                  </div>
                  <span className="text-gold">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
