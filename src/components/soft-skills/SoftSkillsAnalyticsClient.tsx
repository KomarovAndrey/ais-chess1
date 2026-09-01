"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import type { ClassCompetencyHeatmap, WeekCompletionRow } from "@/lib/softSkillsAnalytics";
import { SOFT_SKILLS_LEAGUES } from "@/lib/softSkillsModules";

type ModuleComparison = {
  moduleId: string;
  label: string;
  average: number | null;
  studentsWithData: number;
};

export default function SoftSkillsAnalyticsClient() {
  const [moduleId, setModuleId] = useState("1");
  const [week, setWeek] = useState(1);
  const [leagueId, setLeagueId] = useState("");
  const [classHeatmaps, setClassHeatmaps] = useState<ClassCompetencyHeatmap[]>([]);
  const [moduleComparison, setModuleComparison] = useState<ModuleComparison[]>([]);
  const [weekCompletion, setWeekCompletion] = useState<WeekCompletionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ module: moduleId, week: String(week) });
    if (leagueId) params.set("league", leagueId);

    fetch(`/api/soft-skills/analytics?${params}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
        setClassHeatmaps(data.classHeatmaps ?? []);
        setModuleComparison(data.moduleComparison ?? []);
        setWeekCompletion(data.weekCompletion ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false));
  }, [moduleId, week, leagueId]);

  const incomplete = weekCompletion.filter((r) => !r.complete);
  const csvHref = `/api/soft-skills/analytics?format=csv${leagueId ? `&league=${leagueId}` : ""}`;

  return (
    <main className="page-bg min-h-screen">
      <div className="page-shell max-w-6xl">
        <Link
          href="/soft-skills"
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/55 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          К Soft Skills
        </Link>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="page-title">Аналитика Soft Skills</h1>
          </div>
          <a href={csvHref} className="btn-secondary inline-flex items-center gap-2">
            <Download className="h-4 w-4" />
            Экспорт CSV
          </a>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-3">
          <label className="space-y-1.5 text-sm text-white/55">
            <span className="label-dark">Лига</span>
            <select
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              className="input-dark"
            >
              <option value="">Все лиги</option>
              {SOFT_SKILLS_LEAGUES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-6 surface-pad">
          <h2 className="font-display text-lg font-semibold text-white">Сравнение модулей</h2>
          {loading ? (
            <p className="mt-2 text-sm text-white/55">Загрузка…</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {moduleComparison.map((m) => (
                <div
                  key={m.moduleId}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center"
                >
                  <p className="text-xs text-white/45">{m.label}</p>
                  <p className="mt-1 font-display text-xl font-semibold text-gold">
                    {m.average != null ? m.average.toFixed(1) : "—"}
                  </p>
                  <p className="text-[10px] text-white/35">{m.studentsWithData} уч.</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-white">Heatmap по классам</h2>
          {loading ? (
            <p className="text-sm text-white/55">Загрузка…</p>
          ) : classHeatmaps.length === 0 ? (
            <p className="text-sm text-white/55">Нет классов с данными.</p>
          ) : (
            classHeatmaps.map((c) => (
              <div key={c.className} className="surface-pad">
                <h3 className="mb-3 font-semibold text-white">
                  Класс {c.className} · {c.studentCount} уч.
                </h3>
                <div className="space-y-2">
                  {c.skills.map((skill, i) => {
                    const val = c.averages[i];
                    const pct = val != null ? (val / 5) * 100 : 0;
                    return (
                      <div key={skill.id}>
                        <div className="flex justify-between text-xs text-white/55">
                          <span>{skill.label}</span>
                          <span>{val != null ? val.toFixed(1) : "—"}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gold"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="surface-pad">
          <h2 className="font-display text-lg font-semibold text-white">
            Заполнение недели (completion)
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="space-y-1.5 text-sm text-white/55">
              <span className="label-dark">Модуль</span>
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="input-dark w-auto min-w-[5rem]"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm text-white/55">
              <span className="label-dark">Неделя</span>
              <input
                type="number"
                min={1}
                max={12}
                value={week}
                onChange={(e) => setWeek(Number(e.target.value) || 1)}
                className="input-dark w-20"
              />
            </label>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-white/55">Загрузка…</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-white/55">
                Не заполнили все дисциплины: {incomplete.length} из {weekCompletion.length}
              </p>
              <ul className="mt-3 max-h-96 divide-y divide-white/5 overflow-y-auto">
                {incomplete.map((r) => (
                  <li key={r.userId} className="flex justify-between py-2 text-sm">
                    <span className="text-white">{r.displayName}</span>
                    <span className="text-white/45">
                      {r.ratedDisciplines}/{r.expectedDisciplines}
                      {r.className ? ` · ${r.className}` : ""}
                      {r.leagueId ? ` · Л${r.leagueId}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
