"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { colorLabel, type LobbySeekCard } from "@/lib/lobby";

type Props = {
  userId: string | null;
  disabled?: boolean;
  onAccept: (seekId: string) => Promise<void>;
  onOpenSeek: () => void;
};

export default function SeekLobby({ userId, disabled, onAccept, onOpenSeek }: Props) {
  const [seeks, setSeeks] = useState<LobbySeekCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLobby = useCallback(async () => {
    try {
      const res = await fetch("/api/seeks?lobby=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setSeeks(Array.isArray(data.seeks) ? data.seeks : []);
      setError(null);
    } catch {
      /* keep previous list */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setSeeks([]);
      setLoading(false);
      return;
    }
    void loadLobby();
    const poll = setInterval(() => void loadLobby(), 4000);
    const channel = supabase
      .channel("lobby:seeks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_seeks" },
        () => {
          void loadLobby();
        }
      )
      .subscribe();
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [userId, loadLobby]);

  async function handleAccept(seekId: string) {
    if (disabled || acceptingId) return;
    setAcceptingId(seekId);
    setError(null);
    try {
      await onAccept(seekId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось принять вызов");
    } finally {
      setAcceptingId(null);
    }
  }

  if (!userId) {
    return (
      <section className="relative border-t border-white/5">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="font-display text-xl font-semibold text-white">Лобби</h2>
          <p className="mt-2 text-sm text-white/50">
            Войдите, чтобы видеть открытые вызовы и искать соперника в реальном времени.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative border-t border-white/5">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">Открытые вызовы</h2>
            <p className="mt-1 text-sm text-white/45">
              Список обновляется в реальном времени. Или создайте свой поиск.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary gap-2 text-sm"
            disabled={disabled}
            onClick={onOpenSeek}
          >
            <Search className="h-4 w-4" />
            Создать поиск
          </button>
        </div>

        {error && (
          <p className="mb-3 text-sm text-rose-300" role="alert">
            {error}
          </p>
        )}

        {loading && seeks.length === 0 ? (
          <p className="text-sm text-white/40">Загрузка лобби…</p>
        ) : seeks.length === 0 ? (
          <p className="text-sm text-white/40">
            Пока никто не ищет партию. Создайте поиск — соперник увидит вас здесь.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.03]">
            {seeks.map((s) => {
              const isMine = s.userId === userId;
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      {s.displayName}
                      {s.username ? (
                        <span className="ml-1.5 text-white/40">@{s.username}</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-white/45">
                      {s.rating} · {s.timeLabel} · {s.rated ? "рейтинг" : "товарищеская"} ·{" "}
                      {colorLabel(s.color)}
                    </p>
                  </div>
                  {isMine ? (
                    <span className="text-xs text-gold/80">Ваш поиск</span>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary px-4 py-2 text-sm"
                      disabled={disabled || acceptingId === s.id}
                      onClick={() => void handleAccept(s.id)}
                    >
                      {acceptingId === s.id ? "Подключение…" : "Играть"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
