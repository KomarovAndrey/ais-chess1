"use client";

import { useState } from "react";
import Link from "next/link";
import SoftSkillsCompetencyDashboard from "@/components/soft-skills/SoftSkillsCompetencyDashboard";
import type { CompetencySnapshot } from "@/lib/softSkillsCompetencies";
import { formatCompetency } from "@/lib/softSkillsCompetencies";
import { SOFT_SKILLS_MODULES } from "@/lib/softSkillsModules";

export type SoftSkillsPlacesView = {
  leaguePlace: number | null;
  classPlace: number | null;
  teamPlace: number | null;
  overallPlace: number | null;
  overallPoints: number;
  leagueLabel: string | null;
  className: string | null;
  teamLabel: string | null;
};

export type SoftSkillsDashboardView = {
  overall: CompetencySnapshot;
  byModule: Record<string, CompetencySnapshot>;
};

type Props = {
  displayName: string;
  username: string | null;
  softPlaces: SoftSkillsPlacesView | null;
  competencyDashboard: SoftSkillsDashboardView | null;
  loading: boolean;
  showRatingsLink?: boolean;
};

export default function SoftSkillsProfileSection({
  displayName,
  username,
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

  const moduleTitle =
    moduleTab === "overall"
      ? "Компетенции за весь год"
      : `Компетенции · ${SOFT_SKILLS_MODULES.find((m) => m.id === moduleTab)?.label ?? "модуль"}`;

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
      </div>

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
        subtitle="Средний балл по каждой компетенции (1–5 звёзд). Обновляется при внесении новых результатов."
      />

      <div className="surface-pad">
        <h2 className="font-display text-lg font-semibold text-white">Места в рейтинге</h2>
        {loading ? (
          <p className="mt-2 text-sm text-white/55">Загрузка…</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs text-white/45">Место в лиге</p>
              <p className="mt-1 font-display text-2xl font-semibold text-gold">
                {softPlaces?.leaguePlace ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs text-white/45">Место в классе</p>
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
              <p className="text-xs text-white/45">Общий рейтинг</p>
              <p className="mt-1 font-display text-2xl font-semibold text-gold">
                {softPlaces?.overallPlace ?? "—"}
              </p>
              <p className="mt-1 text-xs text-white/40">
                Средний: {formatCompetency(softPlaces?.overallPoints ?? null)} / 5
              </p>
            </div>
          </div>
        )}
        <p className="mt-4 text-xs text-white/40">
          Рейтинг строится по среднему баллу компетенций. Данные обновляются автоматически при
          сохранении результатов на неделе.
        </p>
        {showRatingsLink && (
          <Link
            href="/ratings?view=overall"
            className="mt-3 inline-flex text-sm font-medium text-gold hover:text-gold-bright"
          >
            Открыть рейтинги Soft Skills
          </Link>
        )}
      </div>
    </div>
  );
}
