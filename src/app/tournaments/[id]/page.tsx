"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Trophy, UserPlus } from "lucide-react";

type Player = {
  user_id: string;
  joined_at: string;
  username: string | null;
  display_name: string | null;
};

type TournamentDetail = {
  id: string;
  title: string;
  status: string;
  format: string;
  created_at: string;
  max_players: number | null;
  starts_at: string | null;
  players: Player[];
};

export default function TournamentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/tournaments/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setTournament(data);
      })
      .catch(() => setTournament(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleJoin() {
    if (!id) return;
    setError(null);
    setJoining(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/join`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось записаться");
      const refetch = await fetch(`/api/tournaments/${id}`);
      const updated = await refetch.json().catch(() => null);
      if (updated?.id) setTournament(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 via-white to-orange-50">
        <p className="text-slate-600">Загрузка...</p>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-orange-50 px-4 py-6">
        <div className="mx-auto max-w-2xl">
          <Link href="/tournaments" className="text-sm text-slate-600 hover:text-slate-900">← К турнирам</Link>
          <p className="mt-4 text-slate-600">Турнир не найден.</p>
        </div>
      </main>
    );
  }

  const statusLabel = tournament.status === "open" ? "Запись открыта" : tournament.status === "started" ? "Идёт" : "Завершён";

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-orange-50 px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/tournaments" className="text-sm text-slate-600 hover:text-slate-900">← К турнирам</Link>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Trophy className="h-7 w-7 text-amber-600" />
              {tournament.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {statusLabel} · {tournament.format === "swiss" ? "Швейцарская система" : "Круговая"}
              {tournament.max_players != null && ` · до ${tournament.max_players} уч.`}
            </p>
          </div>
          {tournament.status === "open" && (
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              {joining ? "Записываем…" : "Записаться"}
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Участники ({tournament.players.length})</h2>
          {tournament.players.length === 0 ? (
            <p className="text-sm text-slate-500">Пока никого нет.</p>
          ) : (
            <ul className="space-y-2">
              {tournament.players.map((p, i) => (
                <li key={p.user_id || i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{p.display_name || p.username || "Участник"}</span>
                  <span className="text-slate-400">{new Date(p.joined_at).toLocaleDateString("ru")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
