"use client";

import { useEffect, useState } from "react";
import {
  formatEval,
  stockfishAnalyze,
  type EngineEval,
} from "@/lib/stockfishEngine";

export default function AnalysisPanel(props: {
  fen: string;
  open: boolean;
}) {
  const { fen, open } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ev, setEv] = useState<EngineEval | null>(null);

  useEffect(() => {
    if (!open || !fen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    stockfishAnalyze(fen, { depth: 14, skill: 20 })
      .then((r) => {
        if (!cancelled) setEv(r);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Ошибка анализа");
          setEv(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fen, open]);

  if (!open) return null;

  const bar =
    ev?.mate != null
      ? ev.mate > 0
        ? 100
        : 0
      : ev?.scoreCp != null
        ? Math.max(5, Math.min(95, 50 + ev.scoreCp / 20))
        : 50;

  // Normalize bar to white's perspective roughly via fen turn handled in formatEval display
  const turn = fen.split(" ")[1];
  const whitePct =
    turn === "b" && ev?.scoreCp != null
      ? 100 - Math.max(5, Math.min(95, 50 + ev.scoreCp / 20))
      : turn === "b" && ev?.mate != null
        ? ev.mate > 0
          ? 0
          : 100
        : bar;

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">Анализ Stockfish</h3>
      {loading && <p className="text-xs text-white/45">Считаем позицию…</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {ev && !loading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono text-gold">{formatEval(ev, fen)}</span>
            <span className="text-xs text-white/40">depth {ev.depth}</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full border border-white/10">
            <div className="bg-white transition-all" style={{ width: `${whitePct}%` }} />
            <div className="bg-ink-950 transition-all" style={{ width: `${100 - whitePct}%` }} />
          </div>
          {ev.bestMove && (
            <p className="text-xs text-white/60">
              Лучший ход: <span className="font-mono text-white">{ev.bestMove}</span>
            </p>
          )}
          {ev.pv.length > 0 && (
            <p className="font-mono text-[11px] leading-relaxed text-white/40">
              PV: {ev.pv.slice(0, 8).join(" ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
