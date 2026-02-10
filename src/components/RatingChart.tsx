"use client";

import { useMemo } from "react";

export type RatingPoint = { t: string; r: number };

const START_RATING = 1500;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export default function RatingChart(props: {
  points: RatingPoint[];
  height?: number;
}) {
  const { points, height = 180 } = props;

  const {
    polyline,
    fillPath,
    minR,
    maxR,
    lastR,
    coords,
    yBase,
    showBaseline,
  } = useMemo(() => {
    // Всегда начинаем с 1500: первая точка — стартовая позиция
    const effectivePoints: RatingPoint[] =
      points?.length > 0
        ? [{ t: "", r: START_RATING }, ...points]
        : [];

    if (effectivePoints.length === 0) {
      return {
        polyline: "",
        fillPath: "",
        minR: START_RATING,
        maxR: START_RATING,
        lastR: null as number | null,
        coords: [] as { x: number; y: number }[],
        yBase: 0,
        yScale: 1,
        showBaseline: false,
      };
    }

    const rs = effectivePoints.map((p) => p.r);
    const minVal = Math.min(START_RATING, ...rs);
    const maxVal = Math.max(START_RATING, ...rs);
    const padding = 40;
    const span = Math.max(50, maxVal - minVal);
    const minR = Math.floor(minVal - span * 0.05);
    const maxR = Math.ceil(maxVal + span * 0.05);
    const lastR = points.length > 0 ? points[points.length - 1].r : START_RATING;

    const w = 300;
    const h = height;
    const padLeft = 12;
    const padRight = 12;
    const padTop = 12;
    const padBottom = 20;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    const toY = (r: number) => {
      const t = (r - minR) / (maxR - minR);
      return padTop + (1 - t) * chartH;
    };

    const toX = (i: number) => {
      return padLeft + (i / Math.max(1, effectivePoints.length - 1)) * chartW;
    };

    const coords = effectivePoints.map((p, i) => ({
      x: toX(i),
      y: clamp(toY(p.r), padTop, h - padBottom),
    }));

    const polyline = coords.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" ");

    // Заливка под линией (до нижней границы графика)
    const baseY = clamp(toY(START_RATING), padTop, h - padBottom);
    const bottom = h - padBottom;
    const fillPath =
      `M ${coords[0].x.toFixed(2)} ${bottom}` +
      coords.map((c) => ` L ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join("") +
      ` L ${coords[coords.length - 1].x.toFixed(2)} ${bottom} Z`;

    const yBase = baseY;
    const showBaseline = effectivePoints.length > 1;

    return {
      polyline,
      fillPath,
      minR,
      maxR,
      lastR,
      coords,
      yBase,
      showBaseline,
    };
  }, [points, height]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-md backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-medium text-slate-500">
          {minR === maxR ? `Рейтинг: ${minR}` : `Диапазон: ${minR}–${maxR}`}
          <span className="ml-2 text-slate-400">· старт {START_RATING}</span>
        </div>
        {lastR != null && (
          <div className="text-xs font-semibold text-amber-700">Текущий: {lastR}</div>
        )}
      </div>

      {points.length === 0 ? (
        <div className="text-sm text-slate-600">Недостаточно данных для графика.</div>
      ) : (
        <svg viewBox={`0 0 300 ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient
              id="ratingChartFill"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="300" height={height} rx="14" fill="#f1f5f9" />
          {/* Сетка: горизонтальные линии */}
          {[0.25, 0.5, 0.75].map((frac) => {
            const y = 12 + (1 - frac) * (height - 32);
            return (
              <line
                key={frac}
                x1={12}
                y1={y}
                x2={288}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="0.8"
                strokeDasharray="4 4"
              />
            );
          })}
          {/* Базовая линия 1500 */}
          {showBaseline && (
            <line
              x1={12}
              y1={yBase}
              x2={288}
              y2={yBase}
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="6 4"
            />
          )}
          {/* Заливка под графиком */}
          {coords.length >= 2 && (
            <path d={fillPath} fill="url(#ratingChartFill)" />
          )}
          {/* Линия рейтинга */}
          {coords.length >= 2 && (
            <polyline
              points={polyline}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {/* Точки: первая (1500) — нейтральная, остальные — акцент */}
          {coords.map((c, idx) => (
            <circle
              key={idx}
              cx={c.x}
              cy={c.y}
              r={idx === 0 ? 4 : 4}
              fill={idx === 0 ? "#64748b" : "#2563eb"}
              stroke="white"
              strokeWidth="2"
            />
          ))}
        </svg>
      )}
    </div>
  );
}
