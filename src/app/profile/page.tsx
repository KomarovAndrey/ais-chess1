"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GameParamsModal from "@/components/GameParamsModal";
import RatingChart, { type RatingPoint } from "@/components/RatingChart";

type ProfileData = {
  username: string | null;
  display_name: string;
  bio: string;
  updated_at: string | null;
  rating: number;
  rating_bullet: number;
  rating_blitz: number;
  rating_rapid: number;
  rating_puzzle?: number;
};

type FriendEntry = {
  id: string;
  username: string | null;
  display_name: string;
  rating: number;
  online?: boolean;
  inGameId?: string | null;
};
type PendingIncoming = { id: string; from_user: FriendEntry };
type PendingOutgoing = { id: string; to_user: FriendEntry };
type PlayedGame = {
  id: string;
  created_at: string;
  mode: string;
  white_username: string | null;
  black_username: string | null;
  result: string;
  rating_delta: number;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [activeSection, setActiveSection] = useState<"edit" | "ratings" | "friends" | "games">("ratings");

  const [ratingType, setRatingType] = useState<"bullet" | "blitz" | "rapid">("blitz");
  const [history, setHistory] = useState<{ bullet: RatingPoint[]; blitz: RatingPoint[]; rapid: RatingPoint[] }>({
    bullet: [],
    blitz: [],
    rapid: []
  });

  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<PendingIncoming[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<PendingOutgoing[]>([]);
  const [addFriendUsername, setAddFriendUsername] = useState("");
  const [friendsMessage, setFriendsMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [challengingId, setChallengingId] = useState<string | null>(null);
  const [outgoingChallengeByFriendId, setOutgoingChallengeByFriendId] = useState<Record<string, string>>({});
  const [challengeModalOpenFor, setChallengeModalOpenFor] = useState<FriendEntry | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<{ open: boolean; friend: FriendEntry | null }>({
    open: false,
    friend: null
  });
  const [games, setGames] = useState<PlayedGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);

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
        setBio(data.bio ?? "");
      }
      setLoading(false);
    };
    run();
  }, [router]);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/ratings/history/${user.id}`)
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
  }, [user?.id]);

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

  async function loadPlayedGames() {
    setGamesLoading(true);
    setGamesError(null);
    try {
      const res = await fetch("/api/profile/games");
      if (!res.ok) throw new Error("Не удалось загрузить партии");
      const data = await res.json().catch(() => ({}));
      setGames(Array.isArray(data?.games) ? data.games : []);
    } catch (e) {
      setGamesError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setGamesLoading(false);
    }
  }

  useEffect(() => {
    if (activeSection === "friends") {
      loadFriends();
      loadOutgoingChallenges();
    } else if (activeSection === "games") {
      loadPlayedGames();
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

  async function cancelFriendRequest(requestId: string) {
    const res = await fetch(`/api/friends/requests/${requestId}/cancel`, { method: "POST" });
    if (res.ok) {
      setFriendsMessage({ type: "ok", text: "Заявка отменена." });
      loadFriends();
    }
  }

  async function removeFriend(userId: string) {
    const res = await fetch(`/api/friends/users/${userId}`, { method: "DELETE" });
    if (res.ok) loadFriends();
  }

  async function sendChallenge(
    friendId: string,
    creatorColor: "white" | "black" | "random",
    timeControlSeconds: number,
    incrementSeconds = 0,
    rated = true
  ) {
    setChallengingId(friendId);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: friendId,
          creatorColor,
          timeControlSeconds,
          incrementSeconds,
          rated,
        })
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
          bio: bio.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Не удалось сохранить");
      }
      const data = await res.json();
      setProfile((p) => (p ? { ...p, ...data } : null));
      setMessage({ type: "ok", text: "Изменения сохранены." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Ошибка сохранения." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="page-bg flex min-h-screen items-center justify-center">
        <p className="text-white/55">Загрузка...</p>
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
    <main className="page-bg min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Link>

        <div className="mb-6 surface p-4 md:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-gold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl font-semibold text-white truncate">
                {profile?.username ?? (user.email ?? "Профиль")}
              </h1>
              <p className="text-xs text-white/45 mt-0.5">
                {profile?.username ? "По этому логину вас находят в поиске друзей" : "Логин задаётся при регистрации и не изменяется"}
              </p>
              {profile?.display_name?.trim() && (
                <p className="text-sm text-white/55 mt-0.5">Имя: {profile.display_name.trim()}</p>
              )}
              <p className="text-xs text-white/40 mt-1">{user.email}</p>
            </div>
            <div className="flex shrink-0 gap-3 rounded-xl bg-white/5 px-4 py-2">
              <div className="text-center">
                <div className="text-xs font-medium text-white/45">Bullet</div>
                <div className="text-lg font-bold text-gold">{profile?.rating_bullet ?? 1500}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-medium text-white/45">Blitz</div>
                <div className="text-lg font-bold text-gold">{profile?.rating_blitz ?? 1500}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-medium text-white/45">Rapid</div>
                <div className="text-lg font-bold text-gold">{profile?.rating_rapid ?? 1500}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-medium text-white/45">Задачи</div>
                <div className="text-lg font-bold text-gold">{profile?.rating_puzzle ?? 1500}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/10">
          <div className="flex gap-2 flex-wrap">
            {(["edit", "ratings", "friends", "games"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setActiveSection(s)}
                className={`px-3 py-2 text-sm font-medium rounded-t-lg ${
                  activeSection === s
                    ? "border border-white/10 border-b-ink-900 -mb-px bg-ink-900 text-gold"
                    : "text-white/55 hover:text-white"
                }`}
              >
                {s === "edit" && "Профиль"}
                {s === "ratings" && "Рейтинг"}
                {s === "friends" && "Друзья"}
                {s === "games" && "Партии"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setActiveSection("edit")}
            className="mb-1 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Редактировать профиль
          </button>
        </div>

        {activeSection === "ratings" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setRatingType("bullet")}
                className={`rounded-2xl border p-4 text-left shadow-sm ${
                  ratingType === "bullet" ? "border-gold bg-gold text-ink-900" : "border-white/10 bg-white/5 text-white"
                }`}
              >
                <div className="text-xs font-semibold opacity-90">Bullet</div>
                <div className="mt-1 text-2xl font-extrabold">{profile?.rating_bullet ?? 1500}</div>
              </button>
              <button
                type="button"
                onClick={() => setRatingType("blitz")}
                className={`rounded-2xl border p-4 text-left shadow-sm ${
                  ratingType === "blitz" ? "border-gold bg-gold text-ink-900" : "border-white/10 bg-white/5 text-white"
                }`}
              >
                <div className="text-xs font-semibold opacity-90">Blitz</div>
                <div className="mt-1 text-2xl font-extrabold">{profile?.rating_blitz ?? 1500}</div>
              </button>
              <button
                type="button"
                onClick={() => setRatingType("rapid")}
                className={`rounded-2xl border p-4 text-left shadow-sm ${
                  ratingType === "rapid" ? "border-gold bg-gold text-ink-900" : "border-white/10 bg-white/5 text-white"
                }`}
              >
                <div className="text-xs font-semibold opacity-90">Rapid</div>
                <div className="mt-1 text-2xl font-extrabold">{profile?.rating_rapid ?? 1500}</div>
              </button>
            </div>
            <Link
              href="/zadachi"
              className="block rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:border-gold/40"
            >
              <div className="text-xs font-semibold text-white/70">Задачи</div>
              <div className="mt-1 text-2xl font-extrabold text-white">
                {profile?.rating_puzzle ?? 1500}
              </div>
            </Link>
            <RatingChart points={history[ratingType]} />
          </div>
        )}

        {activeSection === "edit" && (
          <div className="surface p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="display_name" className="text-sm font-medium text-white/70">
                  Имя (как к вам обращаться)
                </label>
                <input
                  id="display_name"
                  type="text"
                  maxLength={100}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base text-white outline-none ring-offset-2 focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                  placeholder="Введите имя"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="bio" className="text-sm font-medium text-white/70">
                  О себе
                </label>
                <textarea
                  id="bio"
                  rows={5}
                  maxLength={2000}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base text-white outline-none ring-offset-2 focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                  placeholder="Расскажите о себе..."
                />
                <p className="text-xs text-white/40">{bio.length} / 2000</p>
              </div>
              {message && (
                <p
                  className={`rounded-xl px-3 py-2 text-sm ${
                    message.type === "ok" ? "bg-green-50 text-green-700" : "border border-red-500/30 bg-red-500/10 text-red-300"
                  }`}
                >
                  {message.text}
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
            </form>
          </div>
        )}

        {activeSection === "games" && (
          <div className="surface p-6 md:p-8 space-y-4">
            <h2 className="font-display text-lg font-semibold text-white mb-2">Партии</h2>
            {gamesLoading && (
              <p className="text-sm text-white/45">Загрузка партий…</p>
            )}
            {gamesError && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {gamesError}
              </p>
            )}
            {!gamesLoading && !gamesError && games.length === 0 && (
              <p className="text-sm text-white/45">
                Пока нет сыгранных рейтинговых партий.
              </p>
            )}
            {!gamesLoading && games.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
                      <th className="py-2 pr-3 text-left font-medium">Дата</th>
                      <th className="py-2 px-3 text-left font-medium">Режим</th>
                      <th className="py-2 px-3 text-left font-medium">Белые</th>
                      <th className="py-2 px-3 text-left font-medium">Чёрные</th>
                      <th className="py-2 px-3 text-left font-medium">Результат</th>
                      <th className="py-2 pl-3 text-right font-medium">Изм. рейтинга</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((g) => (
                      <tr key={g.id} className="border-b border-white/10 last:border-0">
                        <td className="py-2 pr-3 text-white/70 whitespace-nowrap">
                          {new Date(g.created_at).toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2 px-3 text-white/70 whitespace-nowrap">
                          {g.mode}
                        </td>
                        <td className="py-2 px-3 text-white/70 whitespace-nowrap">
                          {g.white_username ?? "—"}
                        </td>
                        <td className="py-2 px-3 text-white/70 whitespace-nowrap">
                          {g.black_username ?? "—"}
                        </td>
                        <td className="py-2 px-3 text-white/70 whitespace-nowrap">
                          {g.result}
                        </td>
                        <td className="py-2 pl-3 text-right whitespace-nowrap">
                          {g.rating_delta > 0 && (
                            <span className="text-green-600 font-semibold">
                              +{g.rating_delta}
                            </span>
                          )}
                          {g.rating_delta < 0 && (
                            <span className="text-red-300 font-semibold">
                              {g.rating_delta}
                            </span>
                          )}
                          {g.rating_delta === 0 && (
                            <span className="text-white/45">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeSection === "friends" && (
          <div className="surface p-6 md:p-8">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white">
              <Users className="h-5 w-5 text-white/55" />
              Друзья
            </h2>
            <p className="text-sm text-white/55 mb-4">
              Поиск друзей по логину. Ваш логин для поиска: {profile?.username ? (
                <span className="font-mono font-semibold text-gold">{profile.username}</span>
              ) : (
                <span className="text-gold">укажите во вкладке «Профиль»</span>
              )}
            </p>

            <form onSubmit={handleAddFriend} className="mb-6 flex gap-2">
              <input
                type="text"
                value={addFriendUsername}
                onChange={(e) => setAddFriendUsername(e.target.value)}
                placeholder="Введите логин пользователя"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base text-white outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
              />
              <button
                type="submit"
                disabled={friendsLoading || !addFriendUsername.trim()}
                className="min-h-[44px] rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4 inline mr-1" />
                Добавить
              </button>
            </form>

            {friendsMessage && (
              <p className={`mb-4 rounded-xl px-3 py-2 text-sm ${friendsMessage.type === "ok" ? "bg-green-50 text-green-700" : "border border-red-500/30 bg-red-500/10 text-red-300"}`}>
                {friendsMessage.text}
              </p>
            )}

            {pendingIncoming.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-white/70 mb-2">Входящие заявки</h3>
                <ul className="space-y-2">
                  {pendingIncoming.map((req) => (
                    <li key={req.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <Link href={req.from_user.username ? `/user/${req.from_user.username}` : "#"} className="text-sm font-medium text-white/85 hover:underline">
                        {req.from_user.display_name || req.from_user.username || "Игрок"} {req.from_user.username && ` (${req.from_user.username})`} · {req.from_user.rating}
                      </Link>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => acceptRequest(req.id)} className="rounded-lg bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">Принять</button>
                        <button type="button" onClick={() => declineRequest(req.id)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10">Отклонить</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pendingOutgoing.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-white/70 mb-2">Исходящие заявки</h3>
                <ul className="space-y-2">
                  {pendingOutgoing.map((req) => (
                    <li
                      key={req.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <Link
                        href={req.to_user.username ? `/user/${req.to_user.username}` : "#"}
                        className="text-sm text-white/55"
                      >
                        {req.to_user.display_name || req.to_user.username || "Игрок"}{" "}
                        {req.to_user.username && ` (${req.to_user.username})`} · ожидание
                      </Link>
                      <button
                        type="button"
                        onClick={() => cancelFriendRequest(req.id)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                      >
                        Отменить заявку
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <h3 className="text-sm font-medium text-white/70 mb-2">Список друзей</h3>
            {friends.length === 0 && pendingIncoming.length === 0 && pendingOutgoing.length === 0 ? (
              <p className="text-sm text-white/45">Друзей пока нет. Введите логин выше, чтобы отправить заявку.</p>
            ) : friends.length === 0 ? (
              <p className="text-sm text-white/45">Нет принятых друзей.</p>
            ) : (
              <ul className="space-y-2">
                {friends.map((f) => (
                  <li key={f.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="min-w-0">
                      <Link href={f.username ? `/user/${f.username}` : "#"} className="text-sm font-medium text-white/85 hover:underline">
                        <span
                          className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
                            f.online ? "bg-emerald-400" : "bg-white/25"
                          }`}
                          title={f.online ? (f.inGameId ? "В игре" : "В сети") : "Не в сети"}
                        />
                        {f.display_name || f.username || "Игрок"} {f.username && ` (${f.username})`} · {f.rating}
                      </Link>
                    </div>
                    <div className="flex gap-2">
                      {outgoingChallengeByFriendId[f.id] ? (
                        <button
                          type="button"
                          onClick={() => cancelChallenge(f.id, outgoingChallengeByFriendId[f.id])}
                          disabled={challengingId !== null}
                          className="rounded-lg bg-gold px-2 py-1 text-xs font-semibold text-ink-900 hover:bg-gold-bright disabled:opacity-50"
                        >
                          {challengingId === f.id ? "Отмена…" : "Отменить вызов"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setChallengeModalOpenFor(f)}
                          disabled={challengingId !== null}
                          className="rounded-lg bg-gold px-2 py-1 text-xs font-medium text-white hover:bg-gold-bright disabled:opacity-50"
                        >
                          {challengingId === f.id ? "Отправка…" : "Вызвать на партию"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setRemoveConfirm({ open: true, friend: f })}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                      >
                        Удалить
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <GameParamsModal
              open={challengeModalOpenFor !== null}
              title="Параметры игры"
              submitLabel="Бросить вызов"
              onClose={() => setChallengeModalOpenFor(null)}
              onSubmit={async ({ creatorColor, timeControlSeconds, incrementSeconds, rated }) => {
                const f = challengeModalOpenFor;
                setChallengeModalOpenFor(null);
                if (!f) return;
                await sendChallenge(f.id, creatorColor, timeControlSeconds, incrementSeconds, rated);
              }}
            />

            {removeConfirm.open && removeConfirm.friend && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-800 p-4 shadow-card">
                  <h3 className="text-sm font-semibold text-white">Подтверждение</h3>
                  <p className="mt-2 text-sm text-white/70">
                    Вы действительно хотите удалить из друзей{" "}
                    <span className="font-semibold">{removeConfirm.friend.display_name || removeConfirm.friend.username || "игрока"}</span>?
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRemoveConfirm({ open: false, friend: null })}
                      className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10"
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
                      className="min-h-[44px] rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
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
