"use client";

import {
  SOFT_SKILLS_STAR_SKILLS,
  formatCompetency,
  type CompetencySnapshot,
} from "@/lib/softSkillsCompetencies";
import { Star } from "lucide-react";

type Props = {
  title: string;
  snapshot: CompetencySnapshot | null;
  loading?: boolean;
};

function CompetencyBar({ label, value }: { label: string; value: number | null }) {
  const pct = value != null ? (value / 5) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-white/70">{label}</span>
        <span className="font-display text-sm font-semibold text-gold">
          {formatCompetency(value)}
          {value != null && <span className="text-xs text-white/40"> / 5</span>}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gold transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function SoftSkillsCompetencyDashboard({
  title,
  snapshot,
  loading,
}: Props) {
  return (
    <div className="surface-pad">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
        {!loading && snapshot?.overall != null && (
          <div className="flex items-center gap-2 rounded-2xl border border-gold/30 bg-gold/10 px-3 py-2">
            <Star className="h-4 w-4 fill-gold text-gold" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/45">Средний</p>
              <p className="font-display text-xl font-semibold text-gold">
                {formatCompetency(snapshot.overall)}
              </p>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-white/55">Загрузка компетенций…</p>
      ) : !snapshot || snapshot.ratingsCount === 0 ? (
        <p className="text-sm text-white/55">
          Пока нет оценок по компетенциям. Они появятся после внесения результатов на неделе.
        </p>
      ) : (
        <div className="space-y-4">
          {SOFT_SKILLS_STAR_SKILLS.map((skill) => (
            <CompetencyBar
              key={skill.id}
              label={skill.label}
              value={snapshot[skill.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
