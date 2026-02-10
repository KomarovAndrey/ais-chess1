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
};

type FriendEntry = { id: string; username: string | null; display_name: string; rating: number };
type PendingIncoming = { id: string; from_user: FriendEntry };
type PendingOutgoing = { id: string; to_user: FriendEntry };

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [activeSection, setActiveSection] = useState<"edit" | "ratings" | "friends">("edit");

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

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-md backdrop-blur md:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-blue-700">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-slate-900 truncate">
                {profile?.username ?? (user.email ?? "Профиль")}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {profile?.username ? "По этому логину вас находят в поиске друзей" : "Логин задаётся при регистрации и не изменяется"}
              </p>
              {profile?.display_name?.trim() && (
                <p className="text-sm text-slate-600 mt-0.5">Имя: {profile.display_name.trim()}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">{user.email}</p>
            </div>
            <div className="flex shrink-0 gap-3 rounded-xl bg-slate-50 px-4 py-2">
              <div className="text-center">
                <div className="text-xs font-medium text-slate-500">Bullet</div>
                <div className="text-lg font-bold text-amber-600">{profile?.rating_bullet ?? 1500}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-medium text-slate-500">Blitz</div>
                <div className="text-lg font-bold text-amber-600">{profile?.rating_blitz ?? 1500}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-medium text-slate-500">Rapid</div>
                <div className="text-lg font-bold text-amber-600">{profile?.rating_rapid ?? 1500}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-b border-slate-200 mb-4 flex-wrap">
          {(["edit", "ratings", "friends"] as const).map((s) => (
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
              {s === "edit" && "Профиль"}
              {s === "ratings" && "Рейтинг"}
              {s === "friends" && "Друзья"}
            </button>
          ))}
        </div>

        {activeSection === "ratings" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setRatingType("bullet")}
                className={`rounded-2xl border p-4 text-left shadow-sm ${
                  ratingType === "bullet" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white/90 text-slate-900"
                }`}
              >
                <div className="text-xs font-semibold opacity-90">Bullet</div>
                <div className="mt-1 text-2xl font-extrabold">{profile?.rating_bullet ?? 1500}</div>
              </button>
              <button
                type="button"
                onClick={() => setRatingType("blitz")}
                className={`rounded-2xl border p-4 text-left shadow-sm ${
                  ratingType === "blitz" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white/90 text-slate-900"
                }`}
              >
                <div className="text-xs font-semibold opacity-90">Blitz</div>
                <div className="mt-1 text-2xl font-extrabold">{profile?.rating_blitz ?? 1500}</div>
              </button>
              <button
                type="button"
                onClick={() => setRatingType("rapid")}
                className={`rounded-2xl border p-4 text-left shadow-sm ${
                  ratingType === "rapid" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white/90 text-slate-900"
                }`}
              >
                <div className="text-xs font-semibold opacity-90">Rapid</div>
                <div className="mt-1 text-2xl font-extrabold">{profile?.rating_rapid ?? 1500}</div>
              </button>
            </div>

            <RatingChart points={history[ratingType]} />
          </div>
        )}

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

        {activeSection === "friends" && (
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur md:p-8">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Users className="h-5 w-5 text-slate-600" />
              Друзья
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Поиск друзей по логину. Ваш логин для поиска: {profile?.username ? (
                <span className="font-mono font-semibold text-blue-700">{profile.username}</span>
              ) : (
                <span className="text-amber-600">укажите во вкладке «Профиль»</span>
              )}
            </p>

            <form onSubmit={handleAddFriend} className="mb-6 flex gap-2">
              <input
                type="text"
                value={addFriendUsername}
                onChange={(e) => setAddFriendUsername(e.target.value)}
                placeholder="Введите логин пользователя"
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
                        {req.from_user.display_name || req.from_user.username || "Игрок"} {req.from_user.username && ` (${req.from_user.username})`} · {req.from_user.rating}
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
                        {req.to_user.display_name || req.to_user.username || "Игрок"} {req.to_user.username && ` (${req.to_user.username})`} · ожидание
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
                      {f.display_name || f.username || "Игрок"} {f.username && ` (${f.username})`} · {f.rating}
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
                          onClick={() => setChallengeModalOpenFor(f)}
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

            <GameParamsModal
              open={challengeModalOpenFor !== null}
              title="Параметры игры"
              submitLabel="Бросить вызов другу"
              onClose={() => setChallengeModalOpenFor(null)}
              onSubmit={async ({ creatorColor, timeControlSeconds }) => {
                const f = challengeModalOpenFor;
                setChallengeModalOpenFor(null);
                if (!f) return;
                await sendChallenge(f.id, creatorColor, timeControlSeconds);
              }}
            />

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
