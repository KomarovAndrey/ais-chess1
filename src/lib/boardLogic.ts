import { Chess, type Square } from "chess.js";

export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function resolveFen(fen: string): string {
  return fen === "startpos" || !fen ? START_FEN : fen;
}

/** Replace the side-to-move field of a FEN. */
export function fenWithTurn(fen: string, turn: "w" | "b"): string {
  const resolved = resolveFen(fen);
  const parts = resolved.split(" ");
  if (parts.length < 2) return resolved;
  parts[1] = turn;
  return parts.join(" ");
}

export function toUci(from: string, to: string, promotion?: string): string {
  return `${from}${to}${promotion ?? ""}`;
}

export function needsPromotion(fen: string, from: Square, to: Square): boolean {
  try {
    const c = new Chess(resolveFen(fen));
    const piece = c.get(from);
    if (!piece || piece.type !== "p") return false;
    const rank = to[1];
    return (piece.color === "w" && rank === "8") || (piece.color === "b" && rank === "1");
  } catch {
    return false;
  }
}

/**
 * Legal destination squares for a piece.
 * If it is not that piece's turn, FEN turn is flipped so premove dests still show.
 */
export function legalDests(fen: string, from: Square): Square[] {
  try {
    const resolved = resolveFen(fen);
    const c = new Chess(resolved);
    const piece = c.get(from);
    if (!piece) return [];
    const view = piece.color === c.turn() ? c : new Chess(fenWithTurn(resolved, piece.color));
    return view.moves({ square: from, verbose: true }).map((m) => m.to as Square);
  } catch {
    return [];
  }
}

export type BoardOrientation = "white" | "black";

/** Top-left of a square as percentages of the board (0, 12.5, … 87.5). */
export function squarePercent(
  square: Square,
  orientation: BoardOrientation
): { left: number; top: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const x = orientation === "white" ? file : 7 - file;
  const y = orientation === "white" ? 7 - rank : rank;
  return { left: (x / 8) * 100, top: (y / 8) * 100 };
}

/** Vertical 4-square promotion menu anchored on the destination square. */
export function promotionMenuPercent(
  to: Square,
  orientation: BoardOrientation
): { left: number; top: number; width: number; height: number } {
  const { left, top } = squarePercent(to, orientation);
  const rank = Number(to[1]);
  const expandDown =
    (orientation === "white" && rank === 8) || (orientation === "black" && rank === 1);
  return {
    left,
    width: 12.5,
    height: 50,
    top: expandDown ? top : top - 37.5,
  };
}
