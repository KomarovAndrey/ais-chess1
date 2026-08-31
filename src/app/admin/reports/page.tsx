"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Report = {
  id: string;
  reporter_id: string;
  target_user_id: string | null;
  game_id: string | null;
  reason: string;
  created_at: string;
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Нет доступа");
        setReports(Array.isArray(data.reports) ? data.reports : []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"));
  }, []);

  return (
    <main className="page-bg min-h-screen px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-white/55 hover:text-white">
          ← На главную
        </Link>
        <h1 className="mt-4 font-display text-xl font-semibold text-white">Жалобы</h1>
        <p className="mt-1 text-sm text-white/45">Только для роли admin.</p>
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        {reports && reports.length === 0 && (
          <p className="mt-4 text-sm text-white/55">Жалоб нет.</p>
        )}
        <ul className="mt-4 space-y-3">
          {(reports ?? []).map((r) => (
            <li key={r.id} className="surface p-4 text-sm text-white/80">
              <p>{r.reason}</p>
              <p className="mt-2 text-xs text-white/40">
                {new Date(r.created_at).toLocaleString("ru")}
                {r.target_user_id ? ` · user ${r.target_user_id.slice(0, 8)}` : ""}
                {r.game_id ? (
                  <>
                    {" · партия "}
                    <span className="font-mono text-white/55">{r.game_id.slice(0, 8)}</span>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
