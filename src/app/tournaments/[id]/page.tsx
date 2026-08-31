"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Trophy, UserPlus, Search, LogOut } from "lucide-react";
import { formatTimeControl } from "@/lib/timeControls";
import { supabase } from "@/lib/supabaseClient";

type Player = {
  user_id: string;
  joined_at: string;
  username: string | null;
  display_name: string | null;
  score: number;
  games_played: number;
  withdrawn: boolean;
  pairing_ready?: string | null;
};

type TournamentDetail = {
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
  joined?: boolean;
  players: Player[];
};

export default function TournamentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const autoPlayDoneRef = useRef(false);

  const reload = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/tournaments/${id}`);
    const data = await res.json().catch(() => null);
    if (data?.id) setTournament(data);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    reload()
      .catch(() => setTournament(null))
      .finally(() => setLoading(false));

    const channel = supabase
      .channel(`tournament:${id}:standings`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournament_players",
          filter: `tournament_id=eq.${id}`,
        },
        () => void reload()
      )
      .subscribe();

    const poll = setInterval(() => void reload(), 12000);

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [id, reload]);

  const stopSeekWatchers = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (seekChannelRef.current) {
      supabase.removeChannel(seekChannelRef.current);
      seekChannelRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopSeekWatchers();
  }, [stopSeekWatchers]);

  async function cancelSeek() {
    stopSeekWatchers();
    try {
      if (id) {
        await fetch(`/api/tournaments/${id}/play`, { method: "DELETE" });
      }
    } catch {
      /* ignore */
    }
    setSeeking(false);
  }

  async function enterPairing() {
    if (!id) return;
    setError(null);
    setSeeking(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/play`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось войти в паринг");

      if (data.gameId) {
        setSeeking(false);
        router.push(`/play/${data.gameId}`);
        return;
      }

      stopSeekWatchers();

      const checkMatched = async () => {
        try {
          const r = await fetch("/api/seeks");
          if (!r.ok) return;
          const j = await r.json();
          if (j.seek?.status === "matched" && j.seek.game_id) {
            stopSeekWatchers();
            setSeeking(false);
            router.push(`/play/${j.seek.game_id}`);
          }
        } catch {
          /* ignore */
        }
      };

      pollRef.current = setInterval(() => void checkMatched(), 2000);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (uid) {
        const channel = supabase
          .channel(`tournament-seek:${id}:${uid}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "game_seeks",
              filter: `user_id=eq.${uid}`,
            },
            (payload) => {
              const row = payload.new as { status?: string; game_id?: string | null };
              if (row?.status === "matched" && row.game_id) {
                stopSeekWatchers();
                setSeeking(false);
                router.push(`/play/${row.game_id}`);
              }
            }
          )
          .subscribe();
        seekChannelRef.current = channel;
      }
    } catch (e) {
      setSeeking(false);
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  useEffect(() => {
    if (!tournament?.joined || tournament.status !== "started") return;
    const autoplay =
      searchParams.get("autoplay") === "1" || searchParams.get("autoplay") === "true";
    if (autoPlayDoneRef.current) return;
    if (!autoplay) return;
    autoPlayDoneRef.current = true;
    void enterPairing();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autoplay once when returning from game
  }, [tournament?.joined, tournament?.status, searchParams]);

  async function handleJoin() {
    if (!id) return;
    setError(null);
    setJoining(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/join`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось записаться");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    if (!id) return;
    setError(null);
    try {
      const res = await fetch(`/api/tournaments/${id}/leave`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось выйти");
      await cancelSeek();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  if (loading) {
    return (
      <main className="page-bg flex min-h-screen items-center justify-center">
        <p className="text-white/55">Загрузка...</p>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="page-bg min-h-screen px-4 py-6">
        <div className="mx-auto max-w-2xl">
          <Link href="/tournaments" className="text-sm text-white/55 hover:text-white">
            ← К турнирам
          </Link>
          <p className="mt-4 text-white/55">Турнир не найден.</p>
        </div>
      </main>
    );
  }

  const statusLabel =
    tournament.status === "open"
      ? "Запись открыта"
      : tournament.status === "started"
        ? "Идёт Arena"
        : "Завершён";

  const activePlayers = tournament.players.filter((p) => !p.withdrawn);
  const waitingCount = activePlayers.filter((p) => p.pairing_ready).length;
  const canJoin =
    tournament.status === "open" ||
    (tournament.format === "arena" && tournament.status === "started");
  const canPlay = tournament.joined && tournament.status === "started";

  return (
    <main className="page-bg min-h-screen px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/tournaments" className="text-sm text-white/55 hover:text-white">
          ← К турнирам
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white">
              <Trophy className="h-7 w-7 text-gold" />
              {tournament.title}
            </h1>
            <p className="mt-1 text-sm text-white/45">
              {statusLabel}
              {tournament.format === "arena" ? " · Arena" : ""}
              {typeof tournament.time_control_seconds === "number" && (
                <>
                  {" "}
                  ·{" "}
                  {formatTimeControl(
                    tournament.time_control_seconds,
                    tournament.increment_seconds ?? 0
                  )}
                </>
              )}
              {tournament.rated === false ? " · товарищеский" : " · рейтинговый"}
              {tournament.ends_at && (
                <>
                  {" "}
                  · до{" "}
                  {new Date(tournament.ends_at).toLocaleTimeString("ru", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </>
              )}
              {canPlay && waitingCount > 0 && (
                <> · в паринге: {waitingCount}</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canJoin && !tournament.joined && (
              <button
                type="button"
                onClick={handleJoin}
                disabled={joining}
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-gold-bright disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                {joining ? "Записываем…" : "Записаться"}
              </button>
            )}
            {tournament.joined && tournament.status !== "finished" && (
              <button
                type="button"
                onClick={() => void handleLeave()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" />
                Выйти
              </button>
            )}
            {canPlay && (
              <button
                type="button"
                onClick={() => void enterPairing()}
                disabled={seeking}
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-gold-bright disabled:opacity-50"
              >
                <Search className="h-4 w-4" />
                {seeking ? "В паринге…" : "Играть"}
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

        {seeking && (
          <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/10 p-4 text-center">
            <p className="text-sm font-semibold text-gold">
              В паринге Arena — соперник подберётся автоматически…
            </p>
            <button
              type="button"
              onClick={() => void cancelSeek()}
              className="mt-3 text-xs text-white/60 underline hover:text-white"
            >
              Выйти из паринга
            </button>
          </div>
        )}

        <div className="mt-6 surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">
            Таблица ({activePlayers.length})
          </h2>
          {activePlayers.length === 0 ? (
            <p className="text-sm text-white/45">Пока никого нет.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-white/35">
                  <tr>
                    <th className="pb-2 pr-2">#</th>
                    <th className="pb-2 pr-2">Игрок</th>
                    <th className="pb-2 pr-2 text-right">Очки</th>
                    <th className="pb-2 text-right">Партии</th>
                  </tr>
                </thead>
                <tbody>
                  {activePlayers.map((p, i) => (
                    <tr key={p.user_id} className="border-t border-white/5">
                      <td className="py-2 pr-2 text-white/40">{i + 1}</td>
                      <td className="py-2 pr-2 text-white/80">
                        {p.display_name || p.username || "Участник"}
                        {p.pairing_ready && (
                          <span className="ml-2 text-xs text-gold/70">ищет</span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right font-semibold text-gold">
                        {p.score}
                      </td>
                      <td className="py-2 text-right text-white/45">{p.games_played}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-white/35">
            Победа — 2 очка, ничья — 1, поражение — 0. Два idle игрока в паринге получают партию
            автоматически.
          </p>
        </div>
      </div>
    </main>
  );
}
