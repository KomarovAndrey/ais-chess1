"use client";

import { formatCompetency } from "@/lib/softSkillsCompetencies";
import type { TrendPoint } from "@/lib/softSkillsInsights";

type Props = {
  title: string;
  points: TrendPoint[];
  loading?: boolean;
};

const Y_TICKS = [1, 2, 3, 4, 5];

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

  const chartMin = 0;
  const chartMax = 5;
  const plotLeft = 28;
  const plotRight = 4;
  const plotTop = 8;
  const plotBottom = 36;
  const width = 100;
  const height = 100;
  const plotW = width - plotLeft - plotRight;
  const plotH = height - plotTop - plotBottom;

  const coords = points.map((p, i) => {
    const val = p.composite ?? p.competencyOverall ?? chartMin;
    const x =
      plotLeft + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const y = plotTop + plotH - ((val - chartMin) / (chartMax - chartMin)) * plotH;
    return { x, y, val, label: p.label };
  });

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div className="surface-pad">
      <h3 className="font-display text-base font-semibold text-white">{title}</h3>
      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full min-w-[300px]">
          {Y_TICKS.map((tick) => {
            const y = plotTop + plotH - ((tick - chartMin) / (chartMax - chartMin)) * plotH;
            return (
              <g key={tick}>
                <line
                  x1={plotLeft}
                  y1={y}
                  x2={width - plotRight}
                  y2={y}
                  className="stroke-white/10"
                  strokeWidth="0.3"
                />
                <text
                  x={plotLeft - 2}
                  y={y + 1}
                  textAnchor="end"
                  className="fill-white/35 text-[4px]"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          <line
            x1={plotLeft}
            y1={plotTop + plotH}
            x2={width - plotRight}
            y2={plotTop + plotH}
            className="stroke-white/20"
            strokeWidth="0.4"
          />

          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            className="text-gold"
            points={polyline}
          />

          {coords.map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r="1.8" className="fill-gold" />
              <title>
                {c.label}: {formatCompetency(c.val)}
              </title>
              <text
                x={c.x}
                y={plotTop + plotH + 10}
                textAnchor="middle"
                className="fill-white/50 text-[3.8px]"
              >
                {c.label.length > 12 ? `${c.label.slice(0, 10)}…` : c.label}
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
        {values.length > 0 && (
          <span className="text-white/30">
            · диапазон {Math.min(...values).toFixed(1)}–{Math.max(...values).toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}
