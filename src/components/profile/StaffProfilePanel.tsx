"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

type StaffProfile = {
  username: string | null;
  display_name: string;
  role: string;
};

type StudentRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  class_name?: string | null;
};

export default function StaffProfilePanel({ profile }: { profile: StaffProfile }) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile.display_name ?? "");
  }, [profile.display_name]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (query.trim().length >= 2) params.set("q", query.trim());

    fetch(`/api/profile/students?${params}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Не удалось загрузить учеников");
        if (!cancelled) setStudents(Array.isArray(data.students) ? data.students : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Ошибка");
          setStudents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не удалось сохранить");
      setDisplayName(data.display_name ?? displayName.trim());
      setMessage({ type: "ok", text: "Имя сохранено." });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Ошибка сохранения.",
      });
    } finally {
      setSaving(false);
    }
  }

  const roleLabel = profile.role === "admin" ? "Администратор" : "Учитель";

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

        <div className="surface p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-white/45">{roleLabel}</p>
          <form onSubmit={handleSaveName} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="staff_display_name" className="text-sm font-medium text-white/70">
                Имя
              </label>
              <input
                id="staff_display_name"
                type="text"
                maxLength={100}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base text-white outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                placeholder="Ваше имя"
              />
            </div>
            {message && (
              <p
                className={`rounded-xl px-3 py-2 text-sm ${
                  message.type === "ok"
                    ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border border-red-500/30 bg-red-500/10 text-red-300"
                }`}
              >
                {message.text}
              </p>
            )}
            <button
              type="submit"
              disabled={saving || !displayName.trim()}
              className="min-h-[44px] rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Сохранение…" : "Сохранить имя"}
            </button>
          </form>
        </div>

        <div className="mt-6 surface p-6">
          <h2 className="font-display text-lg font-semibold text-white">Аккаунты учеников</h2>
          <p className="mt-1 text-sm text-white/45">
            Найдите ученика по логину или имени и откройте его профиль.
          </p>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск ученика (от 2 символов)…"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
            />
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          {loading ? (
            <p className="mt-4 text-sm text-white/45">Загрузка…</p>
          ) : students.length === 0 ? (
            <p className="mt-4 text-sm text-white/45">
              {query.trim().length >= 2 ? "Никого не найдено." : "Учеников пока нет."}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-white/10 rounded-xl border border-white/10">
              {students.map((s) => (
                <li key={s.id}>
                  <Link
                    href={s.username ? `/user/${encodeURIComponent(s.username)}` : "#"}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.04]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">
                        {s.display_name?.trim() || s.username || "Ученик"}
                      </div>
                      {s.username && (
                        <div className="truncate text-xs text-white/45">
                          @{s.username}
                          {s.class_name ? ` · ${s.class_name}` : ""}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-gold">Открыть →</span>
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
