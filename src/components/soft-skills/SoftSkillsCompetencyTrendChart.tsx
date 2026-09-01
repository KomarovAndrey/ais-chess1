"use client";

import { formatCompetency } from "@/lib/softSkillsCompetencies";
import type { TrendPoint } from "@/lib/softSkillsInsights";

type Props = {
  title: string;
  points: TrendPoint[];
  loading?: boolean;
};

export default function SoftSkillsCompetencyTrendChart({ title, points, loading }: Props) {
  if (loading) {
    return (
      <div className="surface-pad">
        <p className="text-sm text-white/55">Загрузка графика…</p>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="surface-pad">
        <h3 className="font-display text-base font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-white/55">Пока недостаточно данных для графика.</p>
      </div>
    );
  }

  const values = points
    .map((p) => p.composite ?? p.competencyOverall)
    .filter((v): v is number => v != null && v > 0);
  const maxVal = Math.max(...values, 5);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;
  const height = 120;

  const coords = points.map((p, i) => {
    const val = p.composite ?? p.competencyOverall ?? minVal;
    const x = points.length === 1 ? 50 : (i / (points.length - 1)) * 100;
    const y = height - ((val - minVal) / range) * (height - 8) - 4;
    return { x, y, val, label: p.label };
  });

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div className="surface-pad">
      <h3 className="font-display text-base font-semibold text-white">{title}</h3>
      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 100 ${height + 24}`} className="h-40 w-full min-w-[280px]">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-gold"
            points={polyline}
          />
          {coords.map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r="2.5" className="fill-gold" />
              <text
                x={c.x}
                y={height + 14}
                textAnchor="middle"
                className="fill-white/40 text-[4px]"
              >
                {c.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/45">
        {points.map((p) => (
          <span key={p.label}>
            {p.label}: {formatCompetency(p.composite ?? p.competencyOverall)}
          </span>
        ))}
      </div>
    </div>
  );
}
