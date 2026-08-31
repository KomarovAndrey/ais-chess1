"use client";

import type { GameRatingResult, SideRatingResult } from "@/lib/games/ratingResult";
import { formatRatingDelta } from "@/lib/games/ratingResult";

type Props = {
  ratingResult: GameRatingResult | null;
  whiteLabel: string;
  blackLabel: string;
  whiteAccuracy: number | null;
  blackAccuracy: number | null;
  accuracyLoading: boolean;
  accuracyError: string | null;
  onComputeAccuracy: () => void;
  canComputeAccuracy: boolean;
};

function SideLine(props: {
  label: string;
  side: SideRatingResult | null;
  accuracy: number | null;
  accuracyLoading: boolean;
}) {
  const { label, side, accuracy, accuracyLoading } = props;
  if (!side) {
    return (
      <p className="text-sm text-white/55">
        {label}: рейтинг не обновлён
      </p>
    );
  }
  return (
    <p className="text-sm text-white/80">
      <span className="text-white/50">{label}:</span>{" "}
      {side.ratingBefore}{" "}
      <span
        className={
          side.delta > 0
            ? "font-semibold text-emerald-400"
            : side.delta < 0
              ? "font-semibold text-rose-300"
              : "text-white/60"
        }
      >
        {formatRatingDelta(side.delta)}
      </span>
      → {side.ratingAfter}
      {side.provisional && (
        <span className="ml-1 text-xs text-gold/80">(пробный)</span>
      )}
      {accuracyLoading ? (
        <span className="ml-2 text-xs text-white/40">точность…</span>
      ) : accuracy != null ? (
        <span className="ml-2 text-xs text-white/45">
          точность {accuracy}%
        </span>
      ) : null}
    </p>
  );
}

export default function GameResultSummary({
  ratingResult,
  whiteLabel,
  blackLabel,
  whiteAccuracy,
  blackAccuracy,
  accuracyLoading,
  accuracyError,
  onComputeAccuracy,
  canComputeAccuracy,
}: Props) {
  if (!ratingResult?.rated) return null;

  return (
    <div className="mt-3 space-y-1 rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-white/40">
        Рейтинг ({ratingResult.category})
      </p>
      <SideLine
        label={whiteLabel}
        side={ratingResult.white}
        accuracy={whiteAccuracy}
        accuracyLoading={accuracyLoading}
      />
      <SideLine
        label={blackLabel}
        side={ratingResult.black}
        accuracy={blackAccuracy}
        accuracyLoading={accuracyLoading}
      />
      {canComputeAccuracy && whiteAccuracy == null && !accuracyLoading && (
        <button
          type="button"
          onClick={onComputeAccuracy}
          className="mt-2 text-xs text-gold underline hover:text-gold-bright"
        >
          Считать точность ходов (Stockfish)
        </button>
      )}
      {accuracyError && (
        <p className="text-xs text-rose-300">{accuracyError}</p>
      )}
    </div>
  );
}
