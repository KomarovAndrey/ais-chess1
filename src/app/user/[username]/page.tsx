"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Trophy, Swords, ArrowLeft, UserPlus } from "lucide-react";
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
