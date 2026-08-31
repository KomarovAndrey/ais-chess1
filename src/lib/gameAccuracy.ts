import { Chess } from "chess.js";
import { accuracyFromAcpl } from "@/lib/games/ratingResult";

export type MoveAccuracyRow = {
  ply: number;
  uci: string;
  cpl: number;
};

export type GameAccuracyResult = {
  whiteAcpl: number;
  blackAcpl: number;
  whiteAccuracy: number;
  blackAccuracy: number;
  moves: MoveAccuracyRow[];
};

type EvalFn = (fen: string) => Promise<{ scoreCp: number | null; mate: number | null }>;

/** Centipawns from White's perspective. */
function scoreToWhiteCp(
  scoreCp: number | null,
  mate: number | null,
  sideToMove: "w" | "b"
): number {
  if (mate != null) {
    const sign = sideToMove === "w" ? 1 : -1;
    const m = mate * sign;
    return m > 0 ? 10000 - m * 10 : -10000 - m * 10;
  }
  if (scoreCp == null) return 0;
  return sideToMove === "w" ? scoreCp : -scoreCp;
}

function centipawnLoss(beforeWhite: number, afterWhite: number, mover: "w" | "b"): number {
  const loss =
    mover === "w"
      ? beforeWhite - afterWhite
      : afterWhite - beforeWhite;
  return Math.max(0, Math.min(1000, loss));
}

/**
 * Analyze a finished game line (UCI moves). Browser-only — pass stockfishAnalyze wrapper.
 * Uses shallow depth for reasonable latency on blitz games.
 */
export async function computeGameAccuracy(
  moves: string[],
  evaluate: EvalFn,
  opts?: { onProgress?: (ply: number, total: number) => void }
): Promise<GameAccuracyResult> {
  const chess = new Chess();
  const moveRows: MoveAccuracyRow[] = [];
  let whiteLossSum = 0;
  let whiteMoves = 0;
  let blackLossSum = 0;
  let blackMoves = 0;

  for (let i = 0; i < moves.length; i++) {
    const uci = moves[i];
    const mover = chess.turn();
    const beforeEval = await evaluate(chess.fen());
    const beforeWhite = scoreToWhiteCp(
      beforeEval.scoreCp,
      beforeEval.mate,
      mover
    );

    const move = chess.move(uci, { strict: false });
    if (!move) break;

    const afterEval = await evaluate(chess.fen());
    const afterSide = chess.turn();
    const afterWhite = scoreToWhiteCp(
      afterEval.scoreCp,
      afterEval.mate,
      afterSide
    );

    const cpl = centipawnLoss(beforeWhite, afterWhite, mover);
    moveRows.push({ ply: i + 1, uci, cpl });

    if (mover === "w") {
      whiteLossSum += cpl;
      whiteMoves++;
    } else {
      blackLossSum += cpl;
      blackMoves++;
    }

    if (opts?.onProgress) {
      opts.onProgress(i + 1, moves.length);
    }
  }

  const whiteAcpl = whiteMoves > 0 ? whiteLossSum / whiteMoves : 0;
  const blackAcpl = blackMoves > 0 ? blackLossSum / blackMoves : 0;

  return {
    whiteAcpl,
    blackAcpl,
    whiteAccuracy: accuracyFromAcpl(whiteAcpl),
    blackAccuracy: accuracyFromAcpl(blackAcpl),
    moves: moveRows,
  };
}
