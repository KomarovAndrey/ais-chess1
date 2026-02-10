"use client";

import { useMemo } from "react";

export type RatingPoint = { t: string; r: number };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export default function RatingChart(props: {
  points: RatingPoint[];
  height?: number;
}) {
  const { points, height = 140 } = props;

  const { polyline, minR, maxR, lastR, coords } = useMemo(() => {
    if (!points || points.length === 0) {
      return {
        polyline: "",
        minR: 1500,
        maxR: 1500,
        lastR: null as number | null,
        coords: [] as { x: number; y: number }[],
      };
    }
    const rs = points.map((p) => p.r);
    const minR = Math.min(...rs);
    const maxR = Math.max(...rs);
    const lastR = rs[rs.length - 1] ?? null;

    const w = 300;
    const h = height;
    const pad = 10;
    const span = Math.max(1, maxR - minR);

    const coords = points.map((p, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
      const y = pad + (1 - (p.r - minR) / span) * (h - pad * 2);
      return { x, y: clamp(y, pad, h - pad) };
    });
    const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    return { polyline, minR, maxR, lastR, coords };
  }, [points, height]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-md backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-medium text-slate-500">
          {minR === maxR ? `Рейтинг: ${minR}` : `Диапазон: ${minR}–${maxR}`}
        </div>
        {lastR != null && (
          <div className="text-xs font-semibold text-amber-700">Текущий: {lastR}</div>
        )}
      </div>

      {points.length === 0 ? (
        <div className="text-sm text-slate-600">Недостаточно данных для графика.</div>
      ) : (
        <svg viewBox={`0 0 300 ${height}`} className="w-full">
          <rect x="0" y="0" width="300" height={height} rx="14" fill="#f8fafc" />
          {points.length > 1 && (
            <polyline
              points={polyline}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {coords.map((c, idx) => (
            <circle
              key={idx}
              cx={c.x}
              cy={c.y}
              r={3}
              fill="#2563eb"
              stroke="white"
              strokeWidth="1"
            />
          ))}
        </svg>
      )}
    </div>
  );
}

