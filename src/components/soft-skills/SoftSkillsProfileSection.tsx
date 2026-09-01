"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import SoftSkillsCompetencyDashboard from "@/components/soft-skills/SoftSkillsCompetencyDashboard";
import SoftSkillsCompetencyHeatmap from "@/components/soft-skills/SoftSkillsCompetencyHeatmap";
import SoftSkillsCompetencyTrendChart from "@/components/soft-skills/SoftSkillsCompetencyTrendChart";
import SoftSkillsDisciplineStats from "@/components/soft-skills/SoftSkillsDisciplineStats";
import SoftSkillsSelfAssessment from "@/components/soft-skills/SoftSkillsSelfAssessment";
import type { CompetencySnapshot } from "@/lib/softSkillsCompetencies";
import { formatCompetency } from "@/lib/softSkillsCompetencies";
import {
  COMPOSITE_FORMULA_LABEL,
  COMPOSITE_FORMULA_PARTIAL_LABEL,
} from "@/lib/softSkillsComposite";
import type {
  CompetencyInsight,
  DisciplineStatRow,
  TrendPoint,
} from "@/lib/softSkillsInsights";
import type { DisciplineIndexSnapshot } from "@/lib/softSkillsDisciplineIndex";
import { SOFT_SKILLS_MODULES, type SoftSkillsModuleId } from "@/lib/softSkillsModules";

export type SoftSkillsPlacesView = {
  leaguePlace: number | null;
  classPlace: number | null;
  teamPlace: number | null;
  overallPlace: number | null;
  overallPoints: number;
  leagueLabel: string | null;
  className: string | null;
  teamLabel: string | null;
  isProvisional?: boolean;
  compositeOverall?: number;
  compositeIsPartial?: boolean;
  disciplineOverall?: number | null;
  competencyOverall?: number | null;
};

export type SoftSkillsDashboardView = {
  overall: CompetencySnapshot;
  byModule: Record<string, CompetencySnapshot>;
  disciplineOverall?: DisciplineIndexSnapshot;
  disciplineByModule?: Record<string, DisciplineIndexSnapshot>;
  compositeOverall?: number;
  compositeIsPartial?: boolean;
  compositeByModule?: Record<string, number>;
  compositeIsPartialByModule?: Record<string, boolean>;
  insights?: CompetencyInsight;
  insightsByModule?: Record<string, CompetencyInsight>;
  trendByWeek?: TrendPoint[];
  trendByWeekByModule?: Record<string, TrendPoint[]>;
  trendByModule?: TrendPoint[];
  heatmap?: {
    modules: { id: string; label: string }[];
    skills: { id: string; label: string }[];
    values: (number | null)[][];
  };
  disciplineStats?: DisciplineStatRow[];
  disciplineStatsByModule?: Record<string, DisciplineStatRow[]>;
  isProvisional?: boolean;
};

type Props = {
  displayName: string;
  username: string | null;
  userId?: string | null;
  isOwnProfile?: boolean;
  softPlaces: SoftSkillsPlacesView | null;
  competencyDashboard: SoftSkillsDashboardView | null;
  loading: boolean;
  showRatingsLink?: boolean;
};

export default function SoftSkillsProfileSection({
  displayName,
  username,
  userId,
  isOwnProfile = false,
  softPlaces,
  competencyDashboard,
  loading,
  showRatingsLink = true,
}: Props) {
  const [moduleTab, setModuleTab] = useState<string>("overall");

  const moduleSnapshot =
    moduleTab === "overall"
      ? competencyDashboard?.overall ?? null
      : competencyDashboard?.byModule[moduleTab] ?? null;

  const moduleInsights =
    moduleTab === "overall"
      ? competencyDashboard?.insights
      : competencyDashboard?.insightsByModule?.[moduleTab];

  const moduleTitle =
    moduleTab === "overall"
      ? "Компетенции за весь год"
      : `Компетенции · ${SOFT_SKILLS_MODULES.find((m) => m.id === moduleTab)?.label ?? "модуль"}`;

  const composite =
    moduleTab === "overall"
      ? competencyDashboard?.compositeOverall
      : competencyDashboard?.compositeByModule?.[moduleTab];

  const compositeIsPartial =
    moduleTab === "overall"
      ? competencyDashboard?.compositeIsPartial
      : competencyDashboard?.compositeIsPartialByModule?.[moduleTab];

  const disciplineIdx =
    moduleTab === "overall"
      ? competencyDashboard?.disciplineOverall?.overall
      : competencyDashboard?.disciplineByModule?.[moduleTab]?.overall;

  const competencyAvg = moduleSnapshot?.overall;

  const disciplineStats =
    moduleTab === "overall"
      ? competencyDashboard?.disciplineStats
      : competencyDashboard?.disciplineStatsByModule?.[moduleTab];

  return (
    <div className="space-y-4">
      <div className="surface p-6">
        <h1 className="font-display text-xl font-semibold text-white">
          {displayName.trim() || username || "Профиль"}
        </h1>
        {username && <p className="mt-1 text-sm text-white/45">@{username}</p>}
        {softPlaces?.className && (
          <p className="mt-1 text-sm text-white/55">Класс: {softPlaces.className}</p>
        )}
        {softPlaces?.leagueLabel && (
          <p className="mt-0.5 text-sm text-white/55">Лига: {softPlaces.leagueLabel}</p>
        )}
        {softPlaces?.teamLabel && (
          <p className="mt-0.5 text-sm text-white/55">Команда: {softPlaces.teamLabel}</p>
        )}
        {(softPlaces?.isProvisional || competencyDashboard?.isProvisional) && !loading && (
          <p className="mt-2 inline-flex rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
            Предварительные данные — нужно больше оценок для точного рейтинга
          </p>
        )}
      </div>

      {!loading && composite != null && composite > 0 && (
        <div className="surface-pad">
          <h2 className="font-display text-lg font-semibold text-white">Итоговый балл</h2>
          <p className="mt-1 text-xs text-white/40">
            {compositeIsPartial ? COMPOSITE_FORMULA_PARTIAL_LABEL : COMPOSITE_FORMULA_LABEL}
          </p>
          {compositeIsPartial && (
            <p className="mt-1 inline-flex rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/55">
              Частичный итог — заполнена только одна часть (компетенции или дисциплины)
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4 text-center">
              <p className="text-xs text-white/45">Итог</p>
              <p className="font-display text-3xl font-semibold text-gold">
                {formatCompetency(composite)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
              <p className="text-xs text-white/45">
                Компетенции{compositeIsPartial ? "" : " (70%)"}
              </p>
              <p className="font-display text-2xl font-semibold text-white">
                {formatCompetency(competencyAvg ?? null)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
              <p className="text-xs text-white/45">
                Дисциплины{compositeIsPartial ? "" : " (30%)"}
              </p>
              <p className="font-display text-2xl font-semibold text-white">
                {formatCompetency(disciplineIdx ?? null)}
              </p>
            </div>
          </div>
        </div>
      )}

      {moduleInsights && !loading && (
        <div className="surface-pad">
          <h2 className="font-display text-lg font-semibold text-white">Инсайты</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {moduleInsights.strongest && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <p className="text-xs text-white/45">Сильная сторона</p>
                <p className="mt-1 font-semibold text-emerald-300">
                  {moduleInsights.strongest.label} · {formatCompetency(moduleInsights.strongest.value)}
                </p>
              </div>
            )}
            {moduleInsights.weakest && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                <p className="text-xs text-white/45">Зона роста</p>
                <p className="mt-1 font-semibold text-amber-200">
                  {moduleInsights.weakest.label} · {formatCompetency(moduleInsights.weakest.value)}
                </p>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/55">
            <span>{moduleInsights.coverageLabel}</span>
            {moduleInsights.trend === "up" && (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <TrendingUp className="h-4 w-4" />+{moduleInsights.trendDelta}
              </span>
            )}
            {moduleInsights.trend === "down" && (
              <span className="inline-flex items-center gap-1 text-red-400">
                <TrendingDown className="h-4 w-4" />
                {moduleInsights.trendDelta}
              </span>
            )}
            {moduleInsights.trend === "stable" && <span>Динамика стабильна</span>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModuleTab("overall")}
          className={moduleTab === "overall" ? "tab-pill-active" : "tab-pill"}
        >
          За год
        </button>
        {SOFT_SKILLS_MODULES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setModuleTab(m.id)}
            className={moduleTab === m.id ? "tab-pill-active" : "tab-pill"}
          >
            {m.label}
          </button>
        ))}
      </div>

      <SoftSkillsCompetencyDashboard
        title={moduleTitle}
        snapshot={moduleSnapshot}
        loading={loading}
        subtitle="Средний балл по каждой компетенции (1–5 звёзд)."
      />

      {userId && moduleTab !== "overall" && (
        <SoftSkillsSelfAssessment
          userId={userId}
          moduleId={moduleTab as SoftSkillsModuleId}
          teacherOverall={moduleSnapshot?.overall ?? null}
          isOwnProfile={isOwnProfile}
        />
      )}

      {moduleTab === "overall" && competencyDashboard?.heatmap && (
        <div className="surface-pad">
          <h2 className="font-display text-lg font-semibold text-white">
            Heatmap · компетенции × модули
          </h2>
          <div className="mt-4">
            <SoftSkillsCompetencyHeatmap data={competencyDashboard.heatmap} loading={loading} />
          </div>
        </div>
      )}

      {moduleTab === "overall" && competencyDashboard?.trendByModule && (
        <SoftSkillsCompetencyTrendChart
          title="Динамика по модулям"
          points={competencyDashboard.trendByModule}
          loading={loading}
        />
      )}

      {moduleTab !== "overall" && competencyDashboard?.trendByWeekByModule?.[moduleTab] && (
        <SoftSkillsCompetencyTrendChart
          title="Динамика по неделям"
          points={competencyDashboard.trendByWeekByModule[moduleTab]}
          loading={loading}
        />
      )}

      {disciplineStats && disciplineStats.length > 0 && (
        <div className="surface-pad">
          <h2 className="font-display text-lg font-semibold text-white">Результаты дисциплин</h2>
          <p className="mt-1 text-xs text-white/40">
            Win/Lose, время, ошибки и голы — сравнение с медианой группы (лига/класс)
            {moduleTab !== "overall" ? " за выбранный модуль" : " за год"}.
          </p>
          <div className="mt-4">
            <SoftSkillsDisciplineStats stats={disciplineStats} loading={loading} />
          </div>
        </div>
      )}

      <div className="surface-pad">
        <h2 className="font-display text-lg font-semibold text-white">Места в рейтинге</h2>
        <p className="mt-1 text-xs text-white/40">
          Место в лиге и общий рейтинг считаются по итоговому баллу за весь год.
        </p>
        {loading ? (
          <p className="mt-2 text-sm text-white/55">Загрузка…</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs text-white/45">Место в лиге (за год)</p>
              <p className="mt-1 font-display text-2xl font-semibold text-gold">
                {softPlaces?.leaguePlace ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs text-white/45">Место в классе (за год)</p>
              <p className="mt-1 font-display text-2xl font-semibold text-gold">
                {softPlaces?.classPlace ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs text-white/45">Место в команде</p>
              <p className="mt-1 font-display text-2xl font-semibold text-gold">
                {softPlaces?.teamPlace ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs text-white/45">Общий рейтинг (за год)</p>
              <p className="mt-1 font-display text-2xl font-semibold text-gold">
                {softPlaces?.overallPlace ?? "—"}
              </p>
              <p className="mt-1 text-xs text-white/40">
                Итог: {formatCompetency(softPlaces?.overallPoints ?? null)} / 5
              </p>
            </div>
          </div>
        )}
        {showRatingsLink && (
          <Link
            href="/ratings?view=overall"
            className="mt-4 inline-flex text-sm font-medium text-gold hover:text-gold-bright"
          >
            Открыть рейтинги Soft Skills
          </Link>
        )}
      </div>
    </div>
  );
}
