"use client";

import { formatCompetency } from "@/lib/softSkillsCompetencies";
import type { DisciplineStatRow } from "@/lib/softSkillsInsights";

type Props = {
  stats: DisciplineStatRow[];
  loading?: boolean;
};

export default function SoftSkillsDisciplineStats({ stats, loading }: Props) {
  if (loading) {
    return <p className="text-sm text-white/55">Загрузка результатов дисциплин…</p>;
  }

  const withData = stats.filter((s) => s.entriesCount > 0);
  if (withData.length === 0) {
    return (
      <p className="text-sm text-white/55">
        Пока нет результатов по дисциплинам Lumo, Robo, Sport, 3D.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {withData.map((s) => (
        <div
          key={s.discipline}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-white">{s.label}</h4>
            <span className="text-sm font-bold text-gold">
              {formatCompetency(s.indexScore)}
            </span>
          </div>
          <div className="mt-2 space-y-1 text-xs text-white/50">
            {s.winRate != null && <p>Win-rate: {s.winRate}%</p>}
            {s.detail && <p>{s.detail}</p>}
            {s.groupMedianIndex != null && (
              <p>Медиана группы: {formatCompetency(s.groupMedianIndex)}</p>
            )}
            {s.indexScore != null && s.groupMedianIndex != null && (
              <p
                className={
                  s.indexScore >= s.groupMedianIndex ? "text-emerald-400/80" : "text-amber-400/80"
                }
              >
                {s.indexScore >= s.groupMedianIndex ? "Выше медианы группы" : "Ниже медианы группы"}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
