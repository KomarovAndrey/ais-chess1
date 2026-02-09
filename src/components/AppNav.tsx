"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, User, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type ProfileInfo = { username: string | null; display_name: string | null };
type SearchHit = { id: string; username: string | null; display_name: string | null };

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
  const searchRef = useRef<HTMLDivElement>(null);
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

  if (loading) {
    return (
      <nav className="flex items-center gap-3 text-sm font-medium text-slate-600">
        <span className="animate-pulse">...</span>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-3">
      {user && (
        <div className="relative hidden md:block" ref={searchRef}>
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20">
            <Search className="h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => searchQuery.length >= 2 && setSearchOpen(true)}
              placeholder="Поиск по игрокам..."
              className="w-36 border-0 bg-transparent py-0.5 pl-2 pr-1 text-sm text-slate-800 placeholder-slate-400 outline-none sm:w-44"
              aria-label="Поиск по игрокам"
              aria-expanded={searchOpen}
              aria-autocomplete="list"
            />
          </div>
          {searchOpen && searchResults.length > 0 && (
            <ul
              className="absolute right-0 top-full z-50 mt-1 max-h-64 w-56 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              role="listbox"
            >
              {searchResults.map((hit) => (
                <li key={hit.id} role="option">
                  <Link
                    href={hit.username ? `/@/${encodeURIComponent(hit.username)}` : "/profile"}
                    onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                    className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <span className="font-medium">{hit.display_name || hit.username || "—"}</span>
                    {hit.username && (
                      <span className="ml-1 text-slate-400">@{hit.username}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {user ? (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              {getInitials(profile, user.email ?? undefined)}
            </span>
            <span className="hidden max-w-[120px] truncate sm:block">
              {profile?.display_name?.trim() || profile?.username || user.email?.split("@")[0] || "Профиль"}
            </span>
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              role="menu"
            >
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                role="menuitem"
              >
                <User className="h-4 w-4" />
                Мой профиль
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
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
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Войти
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Регистрация
          </Link>
        </div>
      )}
    </nav>
  );
}
