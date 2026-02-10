"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trophy, Swords, UserPlus, Users } from "lucide-react";
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

type FriendEntry = { id: string; username: string | null; display_name: string; rating: number };
type PendingIncoming = { id: string; from_user: FriendEntry };
type PendingOutgoing = { id: string; to_user: FriendEntry };

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
  const [activeSection, setActiveSection] = useState<"edit" | "stats" | "games" | "friends">("edit");

  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<PendingIncoming[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<PendingOutgoing[]>([]);
  const [addFriendUsername, setAddFriendUsername] = useState("");
  const [friendsMessage, setFriendsMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [challengingId, setChallengingId] = useState<string | null>(null);
  const [outgoingChallengeByFriendId, setOutgoingChallengeByFriendId] = useState<Record<string, string>>({});
  const [challengeModal, setChallengeModal] = useState<{
    open: boolean;
    friend: FriendEntry | null;
    creatorColor: "white" | "black" | "random";
    timeControlSeconds: number;
  }>({ open: false, friend: null, creatorColor: "random", timeControlSeconds: 300 });
  const [removeConfirm, setRemoveConfirm] = useState<{ open: boolean; friend: FriendEntry | null }>({
    open: false,
    friend: null
  });

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

  async function loadFriends() {
    setFriendsLoading(true);
    setFriendsMessage(null);
    try {
      const res = await fetch("/api/friends");
      if (!res.ok) throw new Error("Не удалось загрузить список");
      const data = await res.json();
      setFriends(data.friends ?? []);
      setPendingIncoming(data.pending_incoming ?? []);
      setPendingOutgoing(data.pending_outgoing ?? []);
    } catch (e) {
      setFriendsMessage({ type: "error", text: e instanceof Error ? e.message : "Ошибка" });
    } finally {
      setFriendsLoading(false);
    }
  }

  async function loadOutgoingChallenges() {
    try {
      const res = await fetch("/api/challenges?scope=outgoing");
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const outgoing = Array.isArray((data as any)?.outgoing) ? (data as any).outgoing : [];
      const map: Record<string, string> = {};
      for (const c of outgoing) {
        const toId = c?.to_user?.id;
        const id = c?.id;
        if (typeof toId === "string" && typeof id === "string") {
          map[toId] = id;
        }
      }
      setOutgoingChallengeByFriendId(map);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (activeSection === "friends") {
      loadFriends();
      loadOutgoingChallenges();
    }
  }, [activeSection]);

  async function handleAddFriend(e: React.FormEvent) {
    e.preventDefault();
    const un = addFriendUsername.trim().toLowerCase();
    if (!un) return;
    setFriendsMessage(null);
    setFriendsLoading(true);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: un })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не удалось отправить заявку");
      setFriendsMessage({ type: "ok", text: "Заявка отправлена." });
      setAddFriendUsername("");
      loadFriends();
    } catch (e) {
      setFriendsMessage({ type: "error", text: e instanceof Error ? e.message : "Ошибка" });
    } finally {
      setFriendsLoading(false);
    }
  }

  async function acceptRequest(requestId: string) {
    const res = await fetch(`/api/friends/requests/${requestId}/accept`, { method: "POST" });
    if (res.ok) loadFriends();
  }

  async function declineRequest(requestId: string) {
    const res = await fetch(`/api/friends/requests/${requestId}/decline`, { method: "POST" });
    if (res.ok) loadFriends();
  }

  async function removeFriend(userId: string) {
    const res = await fetch(`/api/friends/users/${userId}`, { method: "DELETE" });
    if (res.ok) loadFriends();
  }

  async function sendChallenge(friendId: string, creatorColor: "white" | "black" | "random", timeControlSeconds: number) {
    setChallengingId(friendId);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: friendId, creatorColor, timeControlSeconds })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не удалось отправить вызов");
      if (typeof data?.challengeId === "string") {
        setOutgoingChallengeByFriendId((prev) => ({ ...prev, [friendId]: data.challengeId }));
      } else {
        loadOutgoingChallenges();
      }
      setFriendsMessage({ type: "ok", text: "Вызов отправлен. Ожидайте принятия." });
    } finally {
      setChallengingId(null);
    }
  }

  async function cancelChallenge(friendId: string, challengeId: string) {
    setChallengingId(friendId);
    try {
      await fetch(`/api/challenges/${challengeId}/cancel`, { method: "POST" });
      setOutgoingChallengeByFriendId((prev) => {
        const next = { ...prev };
        delete next[friendId];
        return next;
      });
      setFriendsMessage({ type: "ok", text: "Вызов отменён." });
    } finally {
      setChallengingId(null);
    }
  }

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
            {profile?.username && (
              <p className="text-sm text-slate-500 mt-0.5">
                @{profile.username} <span className="text-amber-600 font-semibold">({profile?.rating ?? 1500})</span>
              </p>
            )}
            <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-slate-200 mb-4 flex-wrap">
          {(["edit", "stats", "games", "friends"] as const).map((s) => (
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
              {s === "friends" && "Друзья"}
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

        {activeSection === "friends" && (
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur md:p-8">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Users className="h-5 w-5 text-slate-600" />
              Друзья
            </h2>

            <form onSubmit={handleAddFriend} className="mb-6 flex gap-2">
              <input
                type="text"
                value={addFriendUsername}
                onChange={(e) => setAddFriendUsername(e.target.value)}
                placeholder="Логин пользователя"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={friendsLoading || !addFriendUsername.trim()}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4 inline mr-1" />
                Добавить
              </button>
            </form>

            {friendsMessage && (
              <p className={`mb-4 rounded-xl px-3 py-2 text-sm ${friendsMessage.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {friendsMessage.text}
              </p>
            )}

            {pendingIncoming.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Входящие заявки</h3>
                <ul className="space-y-2">
                  {pendingIncoming.map((req) => (
                    <li key={req.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <Link href={req.from_user.username ? `/user/${req.from_user.username}` : "#"} className="text-sm font-medium text-slate-800 hover:underline">
                        {req.from_user.display_name || req.from_user.username || "Игрок"} {req.from_user.username && `(@${req.from_user.username})`} · {req.from_user.rating}
                      </Link>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => acceptRequest(req.id)} className="rounded-lg bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">Принять</button>
                        <button type="button" onClick={() => declineRequest(req.id)} className="rounded-lg bg-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-400">Отклонить</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pendingOutgoing.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Исходящие заявки</h3>
                <ul className="space-y-2">
                  {pendingOutgoing.map((req) => (
                    <li key={req.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <Link href={req.to_user.username ? `/user/${req.to_user.username}` : "#"} className="text-sm text-slate-600">
                        {req.to_user.display_name || req.to_user.username || "Игрок"} {req.to_user.username && `(@${req.to_user.username})`} · ожидание
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <h3 className="text-sm font-medium text-slate-700 mb-2">Список друзей</h3>
            {friends.length === 0 && pendingIncoming.length === 0 && pendingOutgoing.length === 0 ? (
              <p className="text-sm text-slate-500">Друзей пока нет. Введите логин выше, чтобы отправить заявку.</p>
            ) : friends.length === 0 ? (
              <p className="text-sm text-slate-500">Нет принятых друзей.</p>
            ) : (
              <ul className="space-y-2">
                {friends.map((f) => (
                  <li key={f.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <Link href={f.username ? `/user/${f.username}` : "#"} className="text-sm font-medium text-slate-800 hover:underline">
                      {f.display_name || f.username || "Игрок"} {f.username && `(@${f.username})`} · {f.rating}
                    </Link>
                    <div className="flex gap-2">
                      {outgoingChallengeByFriendId[f.id] ? (
                        <button
                          type="button"
                          onClick={() => cancelChallenge(f.id, outgoingChallengeByFriendId[f.id])}
                          disabled={challengingId !== null}
                          className="rounded-lg bg-slate-700 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          {challengingId === f.id ? "Отмена…" : "Отменить вызов"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setChallengeModal({
                              open: true,
                              friend: f,
                              creatorColor: "random",
                              timeControlSeconds: 300
                            })
                          }
                          disabled={challengingId !== null}
                          className="rounded-lg bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                        >
                          {challengingId === f.id ? "Отправка…" : "Вызвать на партию"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setRemoveConfirm({ open: true, friend: f })}
                        className="rounded-lg bg-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-400"
                      >
                        Удалить
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {challengeModal.open && challengeModal.friend && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <h3 className="text-sm font-semibold text-slate-900">Вызов на партию</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Игрок:{" "}
                    <span className="font-semibold">
                      {challengeModal.friend.display_name || challengeModal.friend.username || "Игрок"}
                    </span>
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
                      onClick={() => setChallengeModal({ open: false, friend: null, creatorColor: "random", timeControlSeconds: 300 })}
                      className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const friend = challengeModal.friend;
                        if (!friend) return;
                        const creatorColor = challengeModal.creatorColor;
                        const time = challengeModal.timeControlSeconds;
                        setChallengeModal({ open: false, friend: null, creatorColor: "random", timeControlSeconds: 300 });
                        await sendChallenge(friend.id, creatorColor, time);
                      }}
                      className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                    >
                      Отправить вызов
                    </button>
                  </div>
                </div>
              </div>
            )}

            {removeConfirm.open && removeConfirm.friend && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <h3 className="text-sm font-semibold text-slate-900">Подтверждение</h3>
                  <p className="mt-2 text-sm text-slate-700">
                    Вы действительно хотите удалить из друзей{" "}
                    <span className="font-semibold">{removeConfirm.friend.display_name || removeConfirm.friend.username || "игрока"}</span>?
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRemoveConfirm({ open: false, friend: null })}
                      className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300"
                    >
                      Нет
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const id = removeConfirm.friend?.id;
                        setRemoveConfirm({ open: false, friend: null });
                        if (id) await removeFriend(id);
                      }}
                      className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Да
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
