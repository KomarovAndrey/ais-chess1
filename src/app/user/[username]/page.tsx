"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, UserPlus, UserMinus, Swords as SwordsIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GameParamsModal from "@/components/GameParamsModal";
import RatingChart, { type RatingPoint } from "@/components/RatingChart";

type ProfileInfo = {
  id: string;
  username: string | null;
  display_name: string;
  bio?: string;
  avatar_url?: string | null;
  updated_at: string | null;
  rating: number;
  rating_bullet: number;
  rating_blitz: number;
  rating_rapid: number;
};

type FriendStatus = "unknown" | "none" | "friends" | "pending_outgoing" | "pending_incoming" | "self";

export default function PublicProfilePage() {
  const params = useParams();
  const username = typeof params?.username === "string" ? params.username : "";
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [addFriendLoading, setAddFriendLoading] = useState(false);
  const [addFriendMessage, setAddFriendMessage] = useState<string | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>("unknown");
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [outgoingChallengeId, setOutgoingChallengeId] = useState<string | null>(null);
  const [challengeModalOpen, setChallengeModalOpen] = useState(false);
  const [ratingType, setRatingType] = useState<"bullet" | "blitz" | "rapid">("blitz");
  const [history, setHistory] = useState<{ bullet: RatingPoint[]; blitz: RatingPoint[]; rapid: RatingPoint[] }>({
    bullet: [],
    blitz: [],
    rapid: []
  });

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
        if (data) setProfile(data.profile);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [username]);

  useEffect(() => {
    if (!profile?.id) return;
    fetch(`/api/ratings/history/${profile.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const mapPoints = (arr: any[]): RatingPoint[] =>
          (Array.isArray(arr) ? arr : [])
            .map((p) => ({ t: String(p.t), r: Number(p.r) }))
            .filter((p) => Number.isFinite(p.r));
        setHistory({
          bullet: mapPoints(data.bullet),
          blitz: mapPoints(data.blitz),
          rapid: mapPoints(data.rapid)
        });
      })
      .catch(() => {});
  }, [profile?.id]);

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
          <p className="text-slate-600 mt-2">Игрок с логином {username} не найден.</p>
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
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-blue-100">
            {profile.avatar_url ? (
              <img
                src={`${profile.avatar_url}${profile.avatar_url.includes("?") ? "&" : "?"}t=${profile.updated_at ?? ""}`}
                alt="Фото профиля"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-blue-700">
                {initials}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900 truncate">
              {profile.display_name || profile.username || "Игрок"}
            </h1>
            <div className="mt-1">
              <span className="text-sm font-semibold text-slate-700">Логин: </span>
              <span className="text-sm font-mono text-blue-700">
                {profile.username ?? "—"}
              </span>
            </div>
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
                        onClick={() => setChallengeModalOpen(true)}
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

                  <GameParamsModal
                    open={challengeModalOpen}
                    title="Параметры игры"
                    submitLabel="Бросить вызов другу"
                    onClose={() => setChallengeModalOpen(false)}
                    onSubmit={async ({ creatorColor, timeControlSeconds }) => {
                      setChallengeModalOpen(false);
                      setAddFriendMessage(null);
                      setAddFriendLoading(true);
                      try {
                        const res = await fetch("/api/challenges", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            toUserId: profile.id,
                            creatorColor,
                            timeControlSeconds
                          })
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data.error ?? "Не удалось отправить вызов");
                        if (typeof data?.challengeId === "string") setOutgoingChallengeId(data.challengeId);
                        setAddFriendMessage("Вызов отправлен. Ожидайте принятия.");
                      } catch (e) {
                        setAddFriendMessage(e instanceof Error ? e.message : "Ошибка");
                      } finally {
                        setAddFriendLoading(false);
                      }
                    }}
                  />
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

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setRatingType("bullet")}
            className={`rounded-2xl border p-4 text-left shadow-sm ${
              ratingType === "bullet" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white/90 text-slate-900"
            }`}
          >
            <div className="text-xs font-semibold opacity-90">Bullet</div>
            <div className="mt-1 text-2xl font-extrabold">{profile.rating_bullet ?? 1500}</div>
          </button>
          <button
            type="button"
            onClick={() => setRatingType("blitz")}
            className={`rounded-2xl border p-4 text-left shadow-sm ${
              ratingType === "blitz" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white/90 text-slate-900"
            }`}
          >
            <div className="text-xs font-semibold opacity-90">Blitz</div>
            <div className="mt-1 text-2xl font-extrabold">{profile.rating_blitz ?? 1500}</div>
          </button>
          <button
            type="button"
            onClick={() => setRatingType("rapid")}
            className={`rounded-2xl border p-4 text-left shadow-sm ${
              ratingType === "rapid" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white/90 text-slate-900"
            }`}
          >
            <div className="text-xs font-semibold opacity-90">Rapid</div>
            <div className="mt-1 text-2xl font-extrabold">{profile.rating_rapid ?? 1500}</div>
          </button>
        </div>

        <RatingChart points={history[ratingType]} />

        {profile.bio?.trim() && (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur md:p-8">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Информация о себе</h2>
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <p className="text-slate-700 whitespace-pre-wrap">{profile.bio.trim()}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
