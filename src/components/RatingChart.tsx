"use client";

import { useMemo } from "react";

export type RatingPoint = { t: string; r: number };

const START_RATING = 1500;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function niceDomain(minVal: number, maxVal: number): { minR: number; maxR: number; ticks: number[] } {
  let lo = Math.min(minVal, START_RATING);
  let hi = Math.max(maxVal, START_RATING);
  const pad = Math.max(40, Math.round((hi - lo) * 0.12));
  lo = Math.floor((lo - pad) / 50) * 50;
  hi = Math.ceil((hi + pad) / 50) * 50;
  if (hi - lo < 200) {
    const mid = (lo + hi) / 2;
    lo = mid - 100;
    hi = mid + 100;
  }
  const step = hi - lo <= 300 ? 50 : 100;
  const ticks: number[] = [];
  for (let r = lo; r <= hi + 0.5; r += step) ticks.push(r);
  return { minR: lo, maxR: hi, ticks };
}

export default function RatingChart(props: {
  points: RatingPoint[];
  height?: number;
}) {
  const { points, height = 180 } = props;

  const {
    polyline,
    fillPath,
    lastR,
    coords,
    yBase,
    showBaseline,
    gridLineYs,
    padLeft,
    padRight,
    minR,
    maxR,
  } = useMemo(() => {
    const effectivePoints: RatingPoint[] =
      points?.length > 0 ? [{ t: "", r: START_RATING }, ...points] : [];

    if (effectivePoints.length === 0) {
      return {
        polyline: "",
        fillPath: "",
        lastR: null as number | null,
        coords: [] as { x: number; y: number }[],
        yBase: 0,
        showBaseline: false,
        gridLineYs: [] as number[],
        padLeft: 12,
        padRight: 12,
        minR: 1300,
        maxR: 1700,
      };
    }

    const lastR = points.length > 0 ? points[points.length - 1].r : START_RATING;
    const ratings = effectivePoints.map((p) => p.r);
    const { minR, maxR, ticks } = niceDomain(
      Math.min(...ratings),
      Math.max(...ratings)
    );

    const w = 300;
    const h = height;
    const padLeft = 12;
    const padRight = 12;
    const padTop = 12;
    const padBottom = 20;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const span = Math.max(1, maxR - minR);

    const toY = (r: number) => {
      const t = (r - minR) / span;
      return padTop + (1 - t) * chartH;
    };

    const toX = (i: number) =>
      padLeft + (i / Math.max(1, effectivePoints.length - 1)) * chartW;

    const coords = effectivePoints.map((p, i) => ({
      x: toX(i),
      y: clamp(toY(p.r), padTop, h - padBottom),
    }));

    const polyline = coords.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" ");

    const baseY = clamp(toY(START_RATING), padTop, h - padBottom);
    const bottom = h - padBottom;
    const fillPath =
      `M ${coords[0].x.toFixed(2)} ${bottom}` +
      coords.map((c) => ` L ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join("") +
      ` L ${coords[coords.length - 1].x.toFixed(2)} ${bottom} Z`;

    return {
      polyline,
      fillPath,
      lastR,
      coords,
      yBase: baseY,
      showBaseline: effectivePoints.length > 1,
      gridLineYs: ticks.map((r) => toY(r)),
      padLeft,
      padRight,
      minR,
      maxR,
    };
  }, [points, height]);

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-950/60 p-4">
      {points.length === 0 ? (
        <div className="text-sm text-white/55">Недостаточно данных для графика.</div>
      ) : (
        <div>
          <div className="mb-1 flex justify-between text-[10px] text-white/35">
            <span>{Math.round(maxR)}</span>
            {lastR != null && <span>сейчас {lastR}</span>}
          </div>
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
                <stop offset="0%" stopColor="#d4a017" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#d4a017" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="300" height={height} rx="14" fill="rgba(255,255,255,0.03)" />
            {gridLineYs.map((y, idx) => (
              <line
                key={idx}
                x1={padLeft}
                y1={y}
                x2={300 - padRight}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="0.6"
              />
            ))}
            {showBaseline && (
              <line
                x1={12}
                y1={yBase}
                x2={288}
                y2={yBase}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="1"
                strokeDasharray="6 4"
              />
            )}
            {coords.length >= 2 && <path d={fillPath} fill="url(#ratingChartFill)" />}
            {coords.length >= 2 && (
              <polyline
                points={polyline}
                fill="none"
                stroke="#d4a017"
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
                r={4}
                fill={idx === 0 ? "#64748b" : "#d4a017"}
                stroke="#0c1017"
                strokeWidth="2"
              />
            ))}
          </svg>
          <div className="mt-1 text-[10px] text-white/35">{Math.round(minR)}</div>
        </div>
      )}
    </div>
  );
}
