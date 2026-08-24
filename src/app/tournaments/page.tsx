"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trophy, Plus, Calendar } from "lucide-react";
import { TIME_PRESETS, formatTimeControl } from "@/lib/timeControls";

type Tournament = {
  id: string;
  title: string;
  status: string;
  format: string;
  created_at: string;
  max_players: number | null;
  starts_at: string | null;
  ends_at?: string | null;
  time_control_seconds?: number;
  increment_seconds?: number;
  rated?: boolean;
  duration_minutes?: number;
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [presetIdx, setPresetIdx] = useState(4); // 5+0
  const [duration, setDuration] = useState(60);
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
    const preset = TIME_PRESETS[presetIdx] ?? TIME_PRESETS[4];
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          format: "arena",
          timeControlSeconds: preset.seconds,
          incrementSeconds: preset.increment,
          durationMinutes: duration,
          rated: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось создать турнир");
      setTournaments((prev) => [
        { ...data, created_at: data.created_at ?? new Date().toISOString() },
        ...prev,
      ]);
      setTitle("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setCreating(false);
    }
  }

  const statusLabel = (s: string) =>
    s === "open" ? "Запись" : s === "started" ? "Идёт" : "Завершён";

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

        <div className="mb-6 surface space-y-4 p-4">
          <h2 className="text-sm font-semibold text-white">Создать Arena</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название турнира"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-gold/50"
            />
            <div>
              <p className="mb-2 text-xs font-medium text-white/45">Контроль</p>
              <div className="grid grid-cols-4 gap-2">
                {TIME_PRESETS.map((p, i) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setPresetIdx(i)}
                    className={`rounded-xl px-2 py-2 text-xs font-bold transition ${
                      presetIdx === i
                        ? "border border-gold bg-gold text-ink-900"
                        : "border border-white/10 bg-white/5 text-white/70"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-white/45">Длительность</p>
              <div className="flex flex-wrap gap-2">
                {[30, 60, 90, 120].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDuration(m)}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      duration === m
                        ? "border border-gold bg-gold text-ink-900"
                        : "border border-white/10 bg-white/5 text-white/70"
                    }`}
                  >
                    {m} мин
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-ink-900 hover:bg-gold-bright disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {creating ? "Создаём…" : "Создать Arena"}
            </button>
          </form>
          {error && <p className="text-sm text-red-300">{error}</p>}
        </div>

        {loading ? (
          <p className="text-center text-white/45">Загрузка...</p>
        ) : tournaments.length === 0 ? (
          <p className="text-center text-white/45">
            Пока нет турниров. Создайте Arena или войдите в аккаунт.
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
                      {statusLabel(t.status)} ·{" "}
                      {t.format === "arena"
                        ? "Arena"
                        : t.format === "swiss"
                          ? "Швейцарка"
                          : "Круговая"}
                      {typeof t.time_control_seconds === "number" && (
                        <>
                          {" "}
                          ·{" "}
                          {formatTimeControl(
                            t.time_control_seconds,
                            t.increment_seconds ?? 0
                          )}
                        </>
                      )}
                      {t.ends_at && (
                        <>
                          {" "}
                          · <Calendar className="inline h-3 w-3" /> до{" "}
                          {new Date(t.ends_at).toLocaleTimeString("ru", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </>
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
