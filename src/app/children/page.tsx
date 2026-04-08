"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Download, RefreshCw, Send } from "lucide-react";

type CommentAuthor = {
  id: string;
  username: string | null;
  display_name: string | null;
  email?: string;
};

type ChildComment = {
  id: string;
  created_at: string;
  body: string;
  author_id: string;
  author?: CommentAuthor | null;
};

type ChildRow = {
  id: string;
  created_at: string;
  full_name: string;
  class_name: string | null;
  child_comments?: ChildComment[];
};

function formatAuthor(a?: CommentAuthor | null) {
  return a?.display_name || a?.username || a?.email || "—";
}

export default function ChildrenCommentsPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ChildRow[]>([]);
  const [query, setQuery] = useState("");
  const [draftByChild, setDraftByChild] = useState<Record<string, string>>({});
  const [savingChildId, setSavingChildId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [newChildClass, setNewChildClass] = useState("");
  const refreshTimer = useRef<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.full_name ?? "").toLowerCase().includes(q));
  }, [rows, query]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/children/table", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAllowed(res.status !== 403 ? null : false);
        throw new Error(data?.error || "Ошибка загрузки");
      }
      setAllowed(true);
      setRows(Array.isArray(data?.children) ? data.children : []);
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // verify logged-in early for nicer message (API still enforces)
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) setAllowed(false);
    });
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("children-comments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "child_comments" },
        () => {
          // debounce refresh bursts when multiple users write
          if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
          refreshTimer.current = window.setTimeout(() => {
            load();
          }, 250);
        }
      )
      .subscribe();

    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function addComment(childId: string) {
    const text = (draftByChild[childId] ?? "").trim();
    if (!text) return;
    setSavingChildId(childId);
    setError(null);
    try {
      const res = await fetch("/api/children/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ child_id: childId, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Ошибка сохранения");
      setDraftByChild((p) => ({ ...p, [childId]: "" }));
      // realtime will refresh; but do fast refresh if realtime is off
      load();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setSavingChildId(null);
    }
  }

  async function addChild() {
    const full_name = newChildName.trim();
    const class_name = newChildClass.trim();
    if (!full_name) return;

    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name,
          class_name: class_name ? class_name : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Ошибка добавления");
      setNewChildName("");
      setNewChildClass("");
      load();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setAdding(false);
    }
  }

  function downloadExcel() {
    window.location.href = "/api/children/export";
  }

  if (allowed === false) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Дети — комментарии</h1>
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Доступ запрещён. Эта вкладка доступна только определённым пользователям (роль teacher/admin).
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Дети — комментарии</h1>
          <p className="mt-1 text-sm text-slate-600">
            Поиск по списку детей, комментарии сохраняются, обновления приходят в реальном времени.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Обновить
          </button>
          <button
            type="button"
            onClick={downloadExcel}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Download className="h-4 w-4" aria-hidden />
            Скачать Excel
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени ребёнка..."
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
        />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Добавить ребёнка</div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={newChildName}
            onChange={(e) => setNewChildName(e.target.value)}
            placeholder="ФИО ребёнка"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
          />
          <input
            value={newChildClass}
            onChange={(e) => setNewChildClass(e.target.value)}
            placeholder="Класс/группа (необязательно)"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
          />
          <button
            type="button"
            onClick={addChild}
            disabled={adding || !newChildName.trim()}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {adding ? "Добавление…" : "Добавить"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Ребёнок
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Класс/группа
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Комментарии
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-600" colSpan={3}>
                    Загрузка…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-600" colSpan={3}>
                    Нет совпадений.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const comments = Array.isArray(r.child_comments) ? r.child_comments : [];
                  const draft = draftByChild[r.id] ?? "";
                  const saving = savingChildId === r.id;
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="px-4 py-4 text-sm font-medium text-slate-900 whitespace-nowrap">
                        {r.full_name}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">
                        {r.class_name || "—"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-3">
                          <div className="max-h-40 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                            {comments.length === 0 ? (
                              <div className="text-sm text-slate-500">Комментариев пока нет.</div>
                            ) : (
                              <ul className="space-y-2">
                                {comments.map((c) => (
                                  <li key={c.id} className="text-sm text-slate-700">
                                    <div className="text-xs text-slate-500">
                                      {new Date(c.created_at).toLocaleString("ru-RU")} — {formatAuthor(c.author)}
                                    </div>
                                    <div className="whitespace-pre-wrap">{c.body}</div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                            <textarea
                              value={draft}
                              onChange={(e) =>
                                setDraftByChild((p) => ({ ...p, [r.id]: e.target.value }))
                              }
                              placeholder="Оставить комментарий…"
                              className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                            />
                            <button
                              type="button"
                              onClick={() => addComment(r.id)}
                              disabled={saving || !draft.trim()}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Send className="h-4 w-4" aria-hidden />
                              {saving ? "Сохранение…" : "Отправить"}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

