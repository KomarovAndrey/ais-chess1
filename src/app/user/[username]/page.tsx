"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Trophy, Swords, ArrowLeft, UserPlus, UserMinus, Swords as SwordsIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type ProfileInfo = {
  id: string;
  username: string | null;
  display_name: string;
  bio: string;
  updated_at: string | null;
  rating: number;
};
type Stats = { total: number; wins: number; losses: number; draws: number };
type GameRow = { id: string; side: string; winner: string | null; status: string; created_at: string; started_at: string | null };

type FriendStatus = "unknown" | "none" | "friends" | "pending_outgoing" | "pending_incoming" | "self";

export default function PublicProfilePage() {
  const params = useParams();
  const username = typeof params?.username === "string" ? params.username : "";
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentGames, setRecentGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [addFriendLoading, setAddFriendLoading] = useState(false);
  const [addFriendMessage, setAddFriendMessage] = useState<string | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>("unknown");
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [outgoingChallengeId, setOutgoingChallengeId] = useState<string | null>(null);
  const [challengeModal, setChallengeModal] = useState<{
    open: boolean;
    creatorColor: "white" | "black" | "random";
    timeControlSeconds: number;
  }>({ open: false, creatorColor: "random", timeControlSeconds: 300 });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!username) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/players/${encodeURIComponent(username)}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setProfile(data.profile);
          setStats(data.stats ?? null);
          setRecentGames(data.recent_games ?? []);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [username]);

  useEffect(() => {
    if (!currentUserId || !profile?.id) return;
    if (currentUserId === profile.id) {
      setFriendStatus("self");
      return;
    }
    let cancelled = false;
    fetch(`/api/friends/users/${profile.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const st = typeof data?.status === "string" ? (data.status as FriendStatus) : "unknown";
        setFriendStatus(st);
      })
      .catch(() => {
        if (!cancelled) setFriendStatus("unknown");
      });
    return () => {
      cancelled = true;
    };
  }, [currentUserId, profile?.id]);

  useEffect(() => {
    if (!currentUserId || !profile?.id) return;
    let cancelled = false;
    fetch("/api/challenges?scope=outgoing")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const outgoing = Array.isArray(data?.outgoing) ? data.outgoing : [];
        const hit = outgoing.find((c: any) => c?.to_user?.id === profile.id);
        setOutgoingChallengeId(typeof hit?.id === "string" ? hit.id : null);
      })
      .catch(() => {
        if (!cancelled) setOutgoingChallengeId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUserId, profile?.id]);

  if (!username) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-orange-50">
        <p className="text-slate-600">Укажите логин в адресе.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-orange-50">
        <p className="text-slate-600">Загрузка...</p>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 px-4 py-8">
        <div className="mx-auto max-w-md text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700 mb-6">
            <ArrowLeft className="h-4 w-4" />
            На главную
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Профиль не найден</h1>
          <p className="text-slate-600 mt-2">Игрок с логином @{username} не найден.</p>
        </div>
      </main>
    );
  }

  const initials = profile.display_name?.trim()
    ? profile.display_name.trim().split(/\s+/).length >= 2
      ? (profile.display_name.trim().split(/\s+/)[0][0] + profile.display_name.trim().split(/\s+/)[1][0]).toUpperCase()
      : profile.display_name.trim().slice(0, 2).toUpperCase()
    : profile.username?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Link>

        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-md backdrop-blur md:p-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-blue-700">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900 truncate">
              {profile.display_name || profile.username || "Игрок"}
            </h1>
            {profile.username && (
              <p className="text-sm text-slate-500 mt-0.5">
                @{profile.username} <span className="text-amber-600 font-semibold">({profile.rating ?? 1500})</span>
              </p>
            )}
          </div>
          {currentUserId && currentUserId !== profile.id && profile.username && (
            <div className="shrink-0">
              {friendStatus === "friends" ? (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    {outgoingChallengeId ? (
                      <button
                        type="button"
                        disabled={addFriendLoading}
                        onClick={async () => {
                          setAddFriendMessage(null);
                          setAddFriendLoading(true);
                          try {
                            const res = await fetch(`/api/challenges/${outgoingChallengeId}/cancel`, { method: "POST" });
                            const data = await res.json().catch(() => ({}));
                            if (!res.ok) throw new Error(data.error ?? "Не удалось отменить вызов");
                            setOutgoingChallengeId(null);
                            setAddFriendMessage("Вызов отменён.");
                          } catch (e) {
                            setAddFriendMessage(e instanceof Error ? e.message : "Ошибка");
                          } finally {
                            setAddFriendLoading(false);
                          }
                        }}
                        className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        Отменить вызов
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={addFriendLoading}
                        onClick={() => setChallengeModal({ open: true, creatorColor: "random", timeControlSeconds: 300 })}
                        className="inline-flex items-center justify-center gap-1 rounded-xl bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                      >
                        <SwordsIcon className="h-4 w-4" />
                        Вызвать на партию
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={addFriendLoading}
                      onClick={() => setRemoveConfirmOpen(true)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      <UserMinus className="h-4 w-4" />
                      Удалить из друзей
                    </button>
                  </div>

                  {removeConfirmOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                        <h3 className="text-sm font-semibold text-slate-900">Подтверждение</h3>
                        <p className="mt-2 text-sm text-slate-700">
                          Вы действительно хотите удалить из друзей?
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setRemoveConfirmOpen(false)}
                            className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300"
                          >
                            Нет
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setAddFriendMessage(null);
                              setAddFriendLoading(true);
                              try {
                                const res = await fetch(`/api/friends/users/${profile.id}`, { method: "DELETE" });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) throw new Error(data.error ?? "Не удалось удалить");
                                setFriendStatus("none");
                                setAddFriendMessage("Удалено из друзей.");
                              } catch (e) {
                                setAddFriendMessage(e instanceof Error ? e.message : "Ошибка");
                              } finally {
                                setAddFriendLoading(false);
                                setRemoveConfirmOpen(false);
                              }
                            }}
                            className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                          >
                            Да
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {challengeModal.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                        <h3 className="text-sm font-semibold text-slate-900">Вызов на партию</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Игрок: <span className="font-semibold">{profile.display_name || profile.username || "Игрок"}</span>
                        </p>

                        <div className="mt-4 space-y-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-700">Цвет</label>
                            <select
                              value={challengeModal.creatorColor}
                              onChange={(e) =>
                                setChallengeModal((p) => ({
                                  ...p,
                                  creatorColor: e.target.value as "white" | "black" | "random"
                                }))
                              }
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="random">Случайный</option>
                              <option value="white">Я играю белыми</option>
                              <option value="black">Я играю чёрными</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-700">Время (на игрока)</label>
                            <select
                              value={challengeModal.timeControlSeconds}
                              onChange={(e) =>
                                setChallengeModal((p) => ({
                                  ...p,
                                  timeControlSeconds: Number(e.target.value)
                                }))
                              }
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                            >
                              <option value={60}>1 мин</option>
                              <option value={180}>3 мин</option>
                              <option value={300}>5 мин</option>
                              <option value={600}>10 мин</option>
                              <option value={900}>15 мин</option>
                            </select>
                          </div>
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setChallengeModal({ open: false, creatorColor: "random", timeControlSeconds: 300 })}
                            className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300"
                          >
                            Отмена
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setAddFriendMessage(null);
                              setAddFriendLoading(true);
                              try {
                                const res = await fetch("/api/challenges", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    toUserId: profile.id,
                                    creatorColor: challengeModal.creatorColor,
                                    timeControlSeconds: challengeModal.timeControlSeconds
                                  })
                                });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) throw new Error(data.error ?? "Не удалось отправить вызов");
                                if (typeof data?.challengeId === "string") setOutgoingChallengeId(data.challengeId);
                                setAddFriendMessage("Вызов отправлен. Ожидайте принятия.");
                                setChallengeModal({ open: false, creatorColor: "random", timeControlSeconds: 300 });
                              } catch (e) {
                                setAddFriendMessage(e instanceof Error ? e.message : "Ошибка");
                              } finally {
                                setAddFriendLoading(false);
                              }
                            }}
                            className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                          >
                            Отправить вызов
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : friendStatus === "pending_outgoing" ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1 rounded-xl bg-slate-300 px-3 py-2 text-sm font-medium text-slate-700 opacity-70"
                >
                  Заявка отправлена
                </button>
              ) : friendStatus === "pending_incoming" ? (
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  Есть заявка · открыть «Друзья»
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={addFriendLoading}
                  onClick={async () => {
                    setAddFriendMessage(null);
                    setAddFriendLoading(true);
                    try {
                      const res = await fetch("/api/friends", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ username: profile.username })
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(data.error ?? "Не удалось");
                      setAddFriendMessage("Заявка отправлена.");
                      setFriendStatus("pending_outgoing");
                    } catch (e) {
                      setAddFriendMessage(e instanceof Error ? e.message : "Ошибка");
                    } finally {
                      setAddFriendLoading(false);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  {addFriendLoading ? "Отправка…" : "Добавить в друзья"}
                </button>
              )}
              {addFriendMessage && <p className="mt-1 text-xs text-slate-600">{addFriendMessage}</p>}
            </div>
          )}
        </div>

        {profile.bio?.trim() && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-md backdrop-blur">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">О себе</h2>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{profile.bio.trim()}</p>
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-md backdrop-blur">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Trophy className="h-5 w-5 text-amber-500" />
            Статистика (рейтинговые партии)
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{stats?.total ?? 0}</p>
              <p className="text-xs text-slate-500">партий</p>
            </div>
            <div className="rounded-xl bg-green-50 p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{stats?.wins ?? 0}</p>
              <p className="text-xs text-slate-500">побед</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{stats?.losses ?? 0}</p>
              <p className="text-xs text-slate-500">поражений</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-4 text-center">
              <p className="text-2xl font-bold text-slate-700">{stats?.draws ?? 0}</p>
              <p className="text-xs text-slate-500">ничьих</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-md backdrop-blur">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Swords className="h-5 w-5 text-slate-600" />
            Последние рейтинговые партии
          </h2>
          {recentGames.length === 0 ? (
            <p className="text-sm text-slate-500">Партий пока нет.</p>
          ) : (
            <ul className="space-y-2">
              {recentGames.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/play/${g.id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    <span className="text-slate-600">
                      {g.side === "white" ? "Белые" : "Чёрные"} · {g.status === "finished" ? (g.winner === "draw" ? "Ничья" : g.winner === g.side ? "Победа" : "Поражение") : g.status}
                    </span>
                    <span className="text-slate-400 text-xs">
                      {g.created_at ? new Date(g.created_at).toLocaleDateString("ru") : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
