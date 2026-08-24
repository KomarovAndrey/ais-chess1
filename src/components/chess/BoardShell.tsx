"use client";

import { useCallback, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";

export type BoardOrientation = "white" | "black";

export type BoardShellProps = {
  fen: string;
  orientation: BoardOrientation;
  /** Whether the user may move pieces now (own turn / active game). */
  interactive: boolean;
  /** Allow queuing a premove while waiting for the opponent. */
  allowPremoves?: boolean;
  onMove: (uci: string) => boolean | void | Promise<boolean | void>;
  className?: string;
  sizeStyle?: React.CSSProperties;
  lastMoveUci?: string | null;
};

type PendingPromotion = {
  from: Square;
  to: Square;
};

const DARK = "#b58863";
const LIGHT = "#f0d9b5";
const SELECT = "rgba(224, 177, 91, 0.55)";
const LEGAL_DOT = "radial-gradient(circle at center, rgba(224, 177, 91, 0.85) 22%, transparent 24%)";
const LAST = "rgba(110, 180, 90, 0.45)";
const CHECK = "rgba(220, 60, 60, 0.55)";

function kingInCheckSquare(fen: string): string | null {
  try {
    const c = new Chess(fen === "startpos" ? undefined : fen);
    if (!c.isCheck()) return null;
    const turn = c.turn();
    const board = c.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p && p.type === "k" && p.color === turn) {
          return p.square;
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function legalTargets(fen: string, from: Square): Square[] {
  try {
    const c = new Chess(fen === "startpos" ? undefined : fen);
    return c.moves({ square: from, verbose: true }).map((m) => m.to as Square);
  } catch {
    return [];
  }
}

function needsPromotion(fen: string, from: Square, to: Square): boolean {
  try {
    const c = new Chess(fen === "startpos" ? undefined : fen);
    const piece = c.get(from);
    if (!piece || piece.type !== "p") return false;
    const rank = to[1];
    return (piece.color === "w" && rank === "8") || (piece.color === "b" && rank === "1");
  } catch {
    return false;
  }
}

function toUci(from: string, to: string, promotion?: string): string {
  return `${from}${to}${promotion ?? ""}`;
}

export default function BoardShell({
  fen,
  orientation,
  interactive,
  allowPremoves = false,
  onMove,
  className,
  sizeStyle,
  lastMoveUci,
}: BoardShellProps) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);

  const position =
    fen === "startpos" || !fen
      ? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
      : fen;

  const lastFrom = lastMoveUci && lastMoveUci.length >= 4 ? lastMoveUci.slice(0, 2) : undefined;
  const lastTo = lastMoveUci && lastMoveUci.length >= 4 ? lastMoveUci.slice(2, 4) : undefined;
  const checkSq = kingInCheckSquare(position);

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastFrom) styles[lastFrom] = { backgroundColor: LAST };
    if (lastTo) styles[lastTo] = { backgroundColor: LAST };
    if (checkSq) styles[checkSq] = { backgroundColor: CHECK };
    if (selected) {
      styles[selected] = { backgroundColor: SELECT };
      for (const t of legalTargets(position, selected)) {
        styles[t] = { background: LEGAL_DOT };
      }
    }
    return styles;
  }, [selected, position, lastFrom, lastTo, checkSq]);

  const attemptMove = useCallback(
    async (from: Square, to: Square, promotion?: string) => {
      if (needsPromotion(position, from, to) && !promotion) {
        setPendingPromotion({ from, to });
        setSelected(null);
        return false;
      }
      const uci = toUci(from, to, promotion);
      const result = await onMove(uci);
      setSelected(null);
      setPendingPromotion(null);
      return result !== false;
    },
    [onMove, position]
  );

  const onPieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string) => {
      if (!interactive && !allowPremoves) return false;
      const from = sourceSquare as Square;
      const to = targetSquare as Square;
      if (needsPromotion(position, from, to)) {
        setPendingPromotion({ from, to });
        return false;
      }
      // Synchronously validate local legality for drag feedback
      try {
        const c = new Chess(position);
        const trial = c.move({ from, to, promotion: "q" });
        if (!trial && !allowPremoves) return false;
      } catch {
        if (!allowPremoves) return false;
      }
      void attemptMove(from, to);
      return true;
    },
    [interactive, allowPremoves, position, attemptMove]
  );

  const onSquareClick = useCallback(
    (square: string) => {
      if (!interactive) return;
      const sq = square as Square;
      if (pendingPromotion) return;

      if (selected) {
        if (selected === sq) {
          setSelected(null);
          return;
        }
        const targets = legalTargets(position, selected);
        if (targets.includes(sq)) {
          void attemptMove(selected, sq);
          return;
        }
      }

      try {
        const c = new Chess(position);
        const piece = c.get(sq);
        if (piece && piece.color === c.turn()) {
          setSelected(sq);
        } else {
          setSelected(null);
        }
      } catch {
        setSelected(null);
      }
    },
    [interactive, selected, position, attemptMove, pendingPromotion]
  );

  const promotionColor = useMemo(() => {
    if (!pendingPromotion) return "w";
    try {
      const c = new Chess(position);
      return c.get(pendingPromotion.from)?.color ?? "w";
    } catch {
      return "w";
    }
  }, [pendingPromotion, position]);

  const promoPieces =
    promotionColor === "w"
      ? [
          { p: "q", label: "♛" },
          { p: "r", label: "♜" },
          { p: "b", label: "♝" },
          { p: "n", label: "♞" },
        ]
      : [
          { p: "q", label: "♕" },
          { p: "r", label: "♖" },
          { p: "b", label: "♗" },
          { p: "n", label: "♘" },
        ];

  return (
    <div className={`relative ${className ?? ""}`} style={sizeStyle}>
      <Chessboard
        position={position}
        onPieceDrop={interactive || allowPremoves ? onPieceDrop : undefined}
        onSquareClick={onSquareClick}
        boardOrientation={orientation}
        arePremovesAllowed={Boolean(allowPremoves && !interactive)}
        customDarkSquareStyle={{ backgroundColor: DARK }}
        customLightSquareStyle={{ backgroundColor: LIGHT }}
        customSquareStyles={customSquareStyles}
        customBoardStyle={{
          borderRadius: 0,
          boxShadow: "0 15px 40px rgba(15,23,42,0.15)",
        }}
        animationDuration={200}
      />

      {pendingPromotion && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink-950/55 backdrop-blur-[2px]">
          <div className="rounded-2xl border border-white/15 bg-ink-800 p-3 shadow-card">
            <p className="mb-2 text-center text-xs font-medium text-white/55">Превращение</p>
            <div className="flex gap-2">
              {promoPieces.map((opt) => (
                <button
                  key={opt.p}
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl text-white transition hover:border-gold hover:bg-gold/20"
                  onClick={() =>
                    void attemptMove(pendingPromotion.from, pendingPromotion.to, opt.p)
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-2 w-full text-center text-xs text-white/40 hover:text-white/70"
              onClick={() => setPendingPromotion(null)}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
