"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, User as UserIcon, LogOut, Bell, Check, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type ProfileInfo = { username: string | null; display_name: string | null };
type SearchHit = { id: string; username: string | null; display_name: string | null };
type IncomingChallenge = {
  id: string;
  from_user: { id: string; username: string | null; display_name: string; rating: number };
  creator_color: "white" | "black" | "random";
  time_control_seconds: number;
  created_at: string;
};
type IncomingFriendRequest = {
  id: string;
  from_user: { id: string; username: string | null; display_name: string; rating: number };
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

function getInitials(profile: ProfileInfo | null, email?: string): string {
  if (profile?.display_name?.trim()) {
    const parts = profile.display_name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return profile.display_name.trim().slice(0, 2).toUpperCase();
  }
  if (profile?.username) return profile.username.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

export default function AppNav() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [incomingChallenges, setIncomingChallenges] = useState<IncomingChallenge[]>([]);
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<IncomingFriendRequest[]>([]);
  const handledAcceptedRef = useRef<Set<string>>(new Set());
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setProfile({ username: data.username ?? null, display_name: data.display_name ?? null });
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/players/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (!cancelled) setSearchResults(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (!cancelled) setSearchResults([]); });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
  }, []);

  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [handleClickOutside]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  async function loadIncomingChallenges() {
    try {
      const res = await fetch("/api/challenges");
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      setIncomingChallenges(Array.isArray(data?.incoming) ? data.incoming : []);
    } catch {
      // ignore
    }
  }

  async function loadIncomingFriendRequests() {
    try {
      const res = await fetch("/api/friends");
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const incoming = Array.isArray((data as any)?.pending_incoming) ? (data as any).pending_incoming : [];
      setIncomingFriendRequests(incoming);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!user) return;
    loadIncomingChallenges();
    loadIncomingFriendRequests();

    const channel = supabase
      .channel(`challenges:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_challenges", filter: `to_user_id=eq.${user.id}` },
        () => {
          loadIncomingChallenges();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests", filter: `to_user_id=eq.${user.id}` },
        () => {
          loadIncomingFriendRequests();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_challenges", filter: `from_user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { id?: string; status?: string; game_id?: string | null };
          if (row?.status === "accepted" && row.game_id) {
            if (row.id && handledAcceptedRef.current.has(row.id)) return;
            if (row.id) handledAcceptedRef.current.add(row.id);
            router.push(`/play/${row.game_id}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, router]);

  if (loading && !user) {
    return (
      <nav className="flex items-center gap-2">
        <Link
          href="/login"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
        >
          Войти
        </Link>
        <Link
          href="/register"
          className="rounded-xl bg-gold px-3 py-2 text-sm font-semibold text-ink-900 shadow-glow hover:bg-gold-bright"
        >
          Регистрация
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-3">
      {user && (
        <>
          {/* Поиск на десктопе */}
          <div className="hidden items-center gap-2 md:flex">
            <div className="relative" ref={searchRef}>
            <div className="flex items-center rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 focus-within:border-gold/50 focus-within:ring-2 focus-within:ring-gold/20">
              <Search className="h-4 w-4 text-white/40" aria-hidden />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => searchQuery.length >= 2 && setSearchOpen(true)}
                placeholder="Поиск игроков..."
                className="w-36 border-0 bg-transparent py-0.5 pl-2 pr-1 text-sm text-white placeholder-white/35 outline-none sm:w-44"
                aria-label="Поиск по игрокам"
                aria-expanded={searchOpen}
                aria-autocomplete="list"
              />
            </div>
            {searchOpen && searchResults.length > 0 && (
              <ul
                className="absolute right-0 top-full z-50 mt-1 max-h-64 w-56 overflow-auto rounded-xl border border-white/10 bg-ink-800 py-1 shadow-card"
                role="listbox"
              >
                {searchResults.map((hit) => (
                  <li key={hit.id} role="option">
                    <Link
                      href={hit.username ? `/user/${encodeURIComponent(hit.username)}` : "/profile"}
                      onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                      className="block px-3 py-2 text-sm text-white/85 hover:bg-white/5"
                    >
                      <span className="font-medium">{hit.display_name || hit.username || "—"}</span>
                      {hit.username && (
                        <span className="ml-1 text-white/40">{hit.username}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          </div>

          {/* Иконка поиска на мобильных (открывает полноэкранный поиск) */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold md:hidden"
            aria-label="Поиск по игрокам"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Уведомления — видимы на всех размерах экрана */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              aria-label="Уведомления"
              aria-expanded={notifOpen}
            >
              <Bell className="h-4 w-4" />
            {incomingChallenges.length + incomingFriendRequests.length > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
                {incomingChallenges.length + incomingFriendRequests.length > 9
                  ? "9+"
                  : incomingChallenges.length + incomingFriendRequests.length}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-ink-800 shadow-card">
                <div className="px-3 py-2 text-sm font-semibold text-white">Уведомления</div>
                <div className="border-t border-white/10" />
                {incomingChallenges.length === 0 && incomingFriendRequests.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-white/50">Нет новых уведомлений.</div>
                ) : (
                  <ul className="max-h-80 overflow-auto py-1">
                    {incomingFriendRequests.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-white/5">
                        <div className="min-w-0">
                          <div className="truncate text-sm text-white/90">
                            <span className="font-medium">
                              {r.from_user.display_name || r.from_user.username || "Игрок"}
                            </span>
                            {r.from_user.username && (
                              <span className="ml-1 text-white/40">{r.from_user.username}</span>
                            )}
                            <span className="ml-2 font-semibold text-gold">
                              ({r.from_user.rating})
                            </span>
                          </div>
                          <div className="text-xs text-white/45">
                            Заявка в друзья · откройте вкладку «Друзья» в профиле
                          </div>
                        </div>
                        <Link
                          href={r.from_user.username ? `/user/${encodeURIComponent(r.from_user.username)}` : "/profile"}
                          className="shrink-0 rounded-lg bg-gold px-2 py-1 text-xs font-semibold text-ink-900 hover:bg-gold-bright"
                        >
                          Открыть
                        </Link>
                      </li>
                    ))}
                    {incomingChallenges.map((c) => (
                      <li key={c.id} className="group flex items-center justify-between gap-3 px-3 py-2 hover:bg-white/5">
                        <div className="min-w-0">
                          <div className="truncate text-sm text-white/90">
                            <span className="font-medium">{c.from_user.display_name}</span>
                            {c.from_user.username && <span className="ml-1 text-white/40">{c.from_user.username}</span>}
                            <span className="ml-2 font-semibold text-gold">({c.from_user.rating})</span>
                          </div>
                          <div className="text-xs text-white/45">
                            Вызов на партию · {Math.floor(c.time_control_seconds / 60)} мин · цвет:{" "}
                            {c.creator_color === "random" ? "случайный" : c.creator_color === "white" ? "белые" : "чёрные"}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={async () => {
                              // оптимистично убираем уведомление сразу
                              setIncomingChallenges((prev) => prev.filter((x) => x.id !== c.id));
                              const res = await fetch(`/api/challenges/${c.id}/accept`, { method: "POST" });
                              const data = await res.json().catch(() => ({}));
                              if (res.ok && data?.gameId) {
                                setNotifOpen(false);
                                router.push(`/play/${data.gameId}`);
                              } else {
                                loadIncomingChallenges();
                              }
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700"
                            aria-label="Принять вызов"
                            title="Принять"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              // оптимистично убираем уведомление сразу
                              setIncomingChallenges((prev) => prev.filter((x) => x.id !== c.id));
                              await fetch(`/api/challenges/${c.id}/decline`, { method: "POST" }).catch(() => {});
                              loadIncomingChallenges();
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-300 text-slate-800 hover:bg-slate-400"
                            aria-label="Отклонить вызов"
                            title="Отклонить"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {user ? (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-sm font-medium text-white/90 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/20 font-semibold text-gold">
              {getInitials(profile, user.email ?? undefined)}
            </span>
            <span className="hidden max-w-[120px] truncate sm:block">
              {profile?.display_name?.trim() || profile?.username || user.email?.split("@")[0] || "Профиль"}
            </span>
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-white/10 bg-ink-800 py-1 shadow-card"
              role="menu"
            >
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-white/85 hover:bg-white/5"
                role="menuitem"
              >
                <UserIcon className="h-4 w-4" />
                Мой профиль
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/85 hover:bg-white/5"
                role="menuitem"
              >
                <LogOut className="h-4 w-4" />
                Выйти
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
          >
            Войти
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-gold px-3 py-2 text-sm font-semibold text-ink-900 shadow-glow hover:bg-gold-bright"
          >
            Регистрация
          </Link>
        </div>
      )}

      {/* Полноэкранный поиск на мобильных */}
      {user && searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/70 backdrop-blur-sm md:hidden">
          <div className="mx-4 mt-16 w-full max-w-md rounded-2xl border border-white/10 bg-ink-800 px-4 py-3 shadow-card">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex flex-1 items-center rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
                <Search className="h-4 w-4 text-white/40" aria-hidden />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск игроков..."
                  className="w-full border-0 bg-transparent py-0.5 pl-2 pr-1 text-sm text-white placeholder-white/35 outline-none"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/15"
                aria-label="Закрыть поиск"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {searchResults.length > 0 ? (
              <ul className="max-h-80 overflow-auto py-1" role="listbox">
                {searchResults.map((hit) => (
                  <li key={hit.id} role="option">
                    <Link
                      href={hit.username ? `/user/${encodeURIComponent(hit.username)}` : "/profile"}
                      onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                      className="block rounded-lg px-2 py-2 text-sm text-white/85 hover:bg-white/5"
                    >
                      <span className="font-medium">{hit.display_name || hit.username || "—"}</span>
                      {hit.username && (
                        <span className="ml-1 text-white/40">{hit.username}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-sm text-white/45">
                Начните вводить логин игрока.
              </p>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
