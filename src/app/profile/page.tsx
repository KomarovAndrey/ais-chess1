"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, ArrowLeft, Trophy, Swords } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const LOGIN_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

type ProfileData = {
  username: string | null;
  display_name: string;
  bio: string;
  updated_at: string | null;
  rating: number;
};

type Stats = { total: number; wins: number; losses: number; draws: number };
type GameRow = { id: string; side: string; winner: string | null; status: string; created_at: string; started_at: string | null };

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentGames, setRecentGames] = useState<GameRow[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [activeSection, setActiveSection] = useState<"edit" | "stats" | "games">("edit");

  useEffect(() => {
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace("/login");
        return;
      }
      setUser(session.user);
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setDisplayName(data.display_name ?? "");
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
        const un = data.username;
        if (un) {
          const pr = await fetch(`/api/players/${encodeURIComponent(un)}`);
          if (pr.ok) {
            const j = await pr.json();
            setStats(j.stats ?? null);
            setRecentGames(j.recent_games ?? []);
          }
        }
      }
      setLoading(false);
    };
    run();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          username: username.trim() || undefined,
          bio: bio.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Не удалось сохранить");
      }
      const data = await res.json();
      setProfile((p) => (p ? { ...p, ...data } : null));
      setUsername(data.username ?? "");
      setMessage({ type: "ok", text: "Изменения сохранены." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Ошибка сохранения." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-orange-50">
        <p className="text-slate-600">Загрузка...</p>
      </main>
    );
  }

  if (!user) return null;

  const initials = profile?.display_name?.trim()
    ? profile.display_name.trim().split(/\s+/).length >= 2
      ? (profile.display_name.trim().split(/\s+/)[0][0] + profile.display_name.trim().split(/\s+/)[1][0]).toUpperCase()
      : profile.display_name.trim().slice(0, 2).toUpperCase()
    : profile?.username?.slice(0, 2).toUpperCase() ?? "?";

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

        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-md backdrop-blur md:p-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-blue-700">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900 truncate">
              {profile?.display_name?.trim() || profile?.username || user.email?.split("@")[0] || "Профиль"}
            </h1>
            <div className="flex items-center justify-between gap-3 mt-0.5">
              {profile?.username ? (
                <p className="text-sm text-slate-500">@{profile.username}</p>
              ) : (
                <span />
              )}
              <span className="text-sm font-semibold text-amber-600 shrink-0" title="Рейтинг">
                {profile?.rating ?? 1500}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-slate-200 mb-4">
          {(["edit", "stats", "games"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setActiveSection(s)}
              className={`px-3 py-2 text-sm font-medium rounded-t-lg ${
                activeSection === s
                  ? "bg-white border border-slate-200 border-b-white -mb-px text-blue-700"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {s === "edit" && "Редактировать"}
              {s === "stats" && "Статистика"}
              {s === "games" && "Партии"}
            </button>
          ))}
        </div>

        {activeSection === "edit" && (
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="display_name" className="text-sm font-medium text-slate-700">
                  Имя (как к вам обращаться)
                </label>
                <input
                  id="display_name"
                  type="text"
                  maxLength={100}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-offset-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Введите имя"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="profile_username" className="text-sm font-medium text-slate-700">
                  Логин (для ссылки на профиль)
                </label>
                <input
                  id="profile_username"
                  type="text"
                  maxLength={30}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-offset-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Латиница, цифры, подчёркивание, 3–30"
                />
                {username && !LOGIN_REGEX.test(username.trim()) && username.length >= 3 && (
                  <p className="text-xs text-amber-600">Только латиница, цифры и _</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="bio" className="text-sm font-medium text-slate-700">
                  О себе
                </label>
                <textarea
                  id="bio"
                  rows={5}
                  maxLength={2000}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-offset-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Расскажите о себе..."
                />
                <p className="text-xs text-slate-400">{bio.length} / 2000</p>
              </div>
              {message && (
                <p
                  className={`rounded-xl px-3 py-2 text-sm ${
                    message.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                  }`}
                >
                  {message.text}
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
            </form>
          </div>
        )}

        {activeSection === "stats" && (
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur md:p-8">
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
        )}

        {activeSection === "games" && (
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur md:p-8">
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
        )}
      </div>
    </main>
  );
}
