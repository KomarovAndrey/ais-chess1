/**
 * Browser Stockfish (lite single-thread) via Web Worker.
 * Engine files live in /engines/ (copied by scripts/copy-stockfish.js).
 */

const ENGINE_URL = "/engines/stockfish-18-lite-single.js";

export type EngineEval = {
  depth: number;
  /** Centipawns from side-to-move perspective, or mate score. */
  scoreCp: number | null;
  mate: number | null;
  bestMove: string | null;
  pv: string[];
};

type Pending = {
  resolve: (value: EngineEval) => void;
  reject: (err: Error) => void;
  bestMove: string | null;
  scoreCp: number | null;
  mate: number | null;
  depth: number;
  pv: string[];
};

let worker: Worker | null = null;
let ready = false;
let readyWaiters: Array<() => void> = [];
let pending: Pending | null = null;
let seq = 0;

function ensureWorker(): Worker {
  if (typeof window === "undefined") {
    throw new Error("Stockfish is browser-only");
  }
  if (worker) return worker;

  worker = new Worker(ENGINE_URL);
  worker.onmessage = (e: MessageEvent) => {
    const line = typeof e.data === "string" ? e.data : "";
    if (line === "uciok" || line.startsWith("id ") || line.startsWith("option ")) {
      return;
    }
    if (line === "readyok") {
      ready = true;
      readyWaiters.splice(0).forEach((fn) => fn());
      return;
    }
    if (!pending) return;

    if (line.startsWith("info ")) {
      const depthM = / depth (\d+)/.exec(line);
      if (depthM) pending.depth = Number(depthM[1]);
      const mateM = / score mate (-?\d+)/.exec(line);
      const cpM = / score cp (-?\d+)/.exec(line);
      if (mateM) {
        pending.mate = Number(mateM[1]);
        pending.scoreCp = null;
      } else if (cpM) {
        pending.scoreCp = Number(cpM[1]);
        pending.mate = null;
      }
      const pvM = / pv (.+)$/.exec(line);
      if (pvM) pending.pv = pvM[1].trim().split(/\s+/);
    }

    if (line.startsWith("bestmove ")) {
      const parts = line.split(/\s+/);
      pending.bestMove = parts[1] && parts[1] !== "(none)" ? parts[1] : null;
      const result: EngineEval = {
        depth: pending.depth,
        scoreCp: pending.scoreCp,
        mate: pending.mate,
        bestMove: pending.bestMove,
        pv: pending.pv,
      };
      const { resolve } = pending;
      pending = null;
      resolve(result);
    }
  };

  worker.onerror = (err) => {
    if (pending) {
      pending.reject(new Error(err.message || "Stockfish worker error"));
      pending = null;
    }
  };

  worker.postMessage("uci");
  worker.postMessage("isready");
  return worker;
}

function whenReady(): Promise<void> {
  ensureWorker();
  if (ready) return Promise.resolve();
  return new Promise((resolve) => {
    readyWaiters.push(resolve);
  });
}

export async function stockfishAnalyze(
  fen: string,
  opts: { depth?: number; movetime?: number; skill?: number } = {}
): Promise<EngineEval> {
  const w = ensureWorker();
  await whenReady();

  // Cancel previous search
  if (pending) {
    w.postMessage("stop");
    pending.reject(new Error("cancelled"));
    pending = null;
  }

  const mySeq = ++seq;
  const depth = opts.depth ?? 12;
  const skill = Math.max(0, Math.min(20, opts.skill ?? 10));

  w.postMessage("ucinewgame");
  w.postMessage(`setoption name Skill Level value ${skill}`);
  w.postMessage(`position fen ${fen}`);

  const go =
    typeof opts.movetime === "number"
      ? `go movetime ${opts.movetime}`
      : `go depth ${depth}`;

  return new Promise<EngineEval>((resolve, reject) => {
    pending = {
      resolve: (v) => {
        if (mySeq !== seq) return;
        resolve(v);
      },
      reject,
      bestMove: null,
      scoreCp: null,
      mate: null,
      depth: 0,
      pv: [],
    };
    w.postMessage(go);
  });
}

export function stockfishQuit() {
  if (worker) {
    try {
      worker.postMessage("quit");
      worker.terminate();
    } catch {
      /* ignore */
    }
    worker = null;
    ready = false;
    pending = null;
  }
}

/** Map UI level 1–8 to Stockfish skill + depth/movetime. */
export function levelToEngineParams(level: number): {
  skill: number;
  depth: number;
  movetime: number;
} {
  const L = Math.max(1, Math.min(8, Math.floor(level)));
  const table: Record<number, { skill: number; depth: number; movetime: number }> = {
    1: { skill: 0, depth: 5, movetime: 200 },
    2: { skill: 3, depth: 6, movetime: 250 },
    3: { skill: 6, depth: 8, movetime: 350 },
    4: { skill: 10, depth: 10, movetime: 450 },
    5: { skill: 13, depth: 12, movetime: 600 },
    6: { skill: 16, depth: 14, movetime: 800 },
    7: { skill: 18, depth: 16, movetime: 1000 },
    8: { skill: 20, depth: 18, movetime: 1200 },
  };
  return table[L];
}

export function formatEval(e: EngineEval, fen: string): string {
  const turn = fen.split(" ")[1] === "b" ? -1 : 1;
  if (e.mate != null) {
    const m = e.mate * turn;
    return m > 0 ? `M${m}` : `−M${Math.abs(m)}`;
  }
  if (e.scoreCp == null) return "—";
  const cp = (e.scoreCp * turn) / 100;
  return (cp >= 0 ? "+" : "") + cp.toFixed(2);
}
