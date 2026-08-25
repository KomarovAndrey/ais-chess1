"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  legalDests,
  needsPromotion,
  promotionMenuPercent,
  resolveFen,
  toUci,
  type BoardOrientation,
} from "@/lib/boardLogic";

export type { BoardOrientation };

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
  showBoardNotation?: boolean;
};

type PendingPromotion = {
  from: Square;
  to: Square;
  asPremove: boolean;
};

type PendingPremove = {
  from: Square;
  to: Square;
  promotion?: string;
};

const DARK = "#b58863";
const LIGHT = "#f0d9b5";
const SELECT = "rgba(224, 177, 91, 0.55)";
const LEGAL_DOT = "radial-gradient(circle at center, rgba(224, 177, 91, 0.85) 22%, transparent 24%)";
const LAST = "rgba(110, 180, 90, 0.45)";
const CHECK = "rgba(220, 60, 60, 0.55)";
const PREMOVE = "rgba(80, 140, 220, 0.5)";

function kingInCheckSquare(fen: string): string | null {
  try {
    const c = new Chess(fen);
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

export default function BoardShell({
  fen,
  orientation,
  interactive,
  allowPremoves = false,
  onMove,
  className,
  sizeStyle,
  lastMoveUci,
  showBoardNotation = true,
}: BoardShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState<number | undefined>(undefined);
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [pendingPremove, setPendingPremove] = useState<PendingPremove | null>(null);
  const lastInteractRef = useRef<{ sq: string; at: number } | null>(null);

  const position = resolveFen(fen);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const update = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w > 0) setBoardWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const lastFrom = lastMoveUci && lastMoveUci.length >= 4 ? lastMoveUci.slice(0, 2) : undefined;
  const lastTo = lastMoveUci && lastMoveUci.length >= 4 ? lastMoveUci.slice(2, 4) : undefined;
  const checkSq = kingInCheckSquare(position);

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastFrom) styles[lastFrom] = { backgroundColor: LAST };
    if (lastTo) styles[lastTo] = { backgroundColor: LAST };
    if (checkSq) styles[checkSq] = { backgroundColor: CHECK };
    if (pendingPremove) {
      styles[pendingPremove.from] = { backgroundColor: PREMOVE };
      styles[pendingPremove.to] = { backgroundColor: PREMOVE };
    }
    if (selected) {
      styles[selected] = { backgroundColor: SELECT };
      for (const t of legalDests(position, selected)) {
        styles[t] = { background: LEGAL_DOT };
      }
    }
    return styles;
  }, [selected, position, lastFrom, lastTo, checkSq, pendingPremove]);

  const attemptMove = useCallback(
    async (from: Square, to: Square, promotion?: string) => {
      if (needsPromotion(position, from, to) && !promotion) {
        setPendingPromotion({ from, to, asPremove: false });
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

  useEffect(() => {
    setSelected(null);
    setPendingPromotion(null);
  }, [position]);

  useEffect(() => {
    if (!interactive || !pendingPremove) return;
    const queued = pendingPremove;
    const id = window.setTimeout(() => {
      setPendingPremove(null);
      void attemptMove(queued.from, queued.to, queued.promotion);
    }, 0);
    return () => window.clearTimeout(id);
  }, [interactive, pendingPremove, attemptMove]);

  const queuePremove = useCallback(
    (from: Square, to: Square, promotion?: string) => {
      if (needsPromotion(position, from, to) && !promotion) {
        setPendingPromotion({ from, to, asPremove: true });
        setSelected(null);
        return;
      }
      setPendingPremove({ from, to, promotion });
      setSelected(null);
      setPendingPromotion(null);
    },
    [position]
  );

  const onPieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string) => {
      if (!interactive && !allowPremoves) return false;
      const from = sourceSquare as Square;
      const to = targetSquare as Square;
      if (!interactive && allowPremoves) {
        queuePremove(from, to);
        return false;
      }
      if (needsPromotion(position, from, to)) {
        setPendingPromotion({ from, to, asPremove: false });
        return false;
      }
      try {
        const c = new Chess(position);
        const trial = c.move({ from, to, promotion: "q" });
        if (!trial) return false;
      } catch {
        return false;
      }
      void attemptMove(from, to);
      return true;
    },
    [interactive, allowPremoves, position, attemptMove, queuePremove]
  );

  const onSquareClick = useCallback(
    (square: string) => {
      if (!interactive && !allowPremoves) return;
      const now = performance.now();
      const prev = lastInteractRef.current;
      if (prev && prev.sq === square && now - prev.at < 80) return;
      lastInteractRef.current = { sq: square, at: now };
      const sq = square as Square;
      if (pendingPromotion) {
        setPendingPromotion(null);
        return;
      }

      if (selected) {
        if (selected === sq) {
          setSelected(null);
          return;
        }
        const targets = legalDests(position, selected);
        if (targets.includes(sq)) {
          if (!interactive && allowPremoves) {
            queuePremove(selected, sq);
            return;
          }
          void attemptMove(selected, sq);
          return;
        }
      }

      try {
        const c = new Chess(position);
        const piece = c.get(sq);
        if (!piece) {
          setSelected(null);
          setPendingPremove(null);
          return;
        }
        const waitingSide = piece.color !== c.turn();
        if (interactive && piece.color === c.turn()) {
          setPendingPremove(null);
          setSelected(sq);
        } else if (!interactive && allowPremoves && waitingSide) {
          setPendingPremove(null);
          setSelected(sq);
        } else {
          setSelected(null);
        }
      } catch {
        setSelected(null);
      }
    },
    [
      interactive,
      allowPremoves,
      selected,
      position,
      attemptMove,
      pendingPromotion,
      queuePremove,
    ]
  );

  const isDraggablePiece = useCallback(
    ({ piece }: { piece: string }) => {
      const color = piece[0] as "w" | "b";
      try {
        const c = new Chess(position);
        if (interactive) return color === c.turn();
        if (allowPremoves) return color !== c.turn();
        return false;
      } catch {
        return false;
      }
    },
    [interactive, allowPremoves, position]
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

  const promoBox = pendingPromotion
    ? promotionMenuPercent(pendingPromotion.to, orientation)
    : null;

  return (
    <div
      ref={containerRef}
      className={`relative ${className ?? ""}`}
      style={{
        ...sizeStyle,
        // Avoid transform/filter here — they break react-chessboard drag coords.
        transform: "none",
        filter: "none",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
      }}
    >
      {boardWidth ? (
        <Chessboard
          position={position}
          boardWidth={boardWidth}
          onPieceDrop={interactive || allowPremoves ? onPieceDrop : undefined}
          onSquareClick={onSquareClick}
          onPieceClick={(_piece, square) => onSquareClick(square)}
          onPromotionCheck={() => false}
          onSquareRightClick={() => {
            setSelected(null);
            setPendingPremove(null);
            setPendingPromotion(null);
          }}
          isDraggablePiece={isDraggablePiece}
          arePiecesDraggable={interactive || allowPremoves}
          arePremovesAllowed={false}
          snapToCursor
          boardOrientation={orientation}
          showBoardNotation={showBoardNotation}
          customDarkSquareStyle={{ backgroundColor: DARK }}
          customLightSquareStyle={{ backgroundColor: LIGHT }}
          customSquareStyles={customSquareStyles}
          customBoardStyle={{
            borderRadius: 0,
            boxShadow: "0 15px 40px rgba(15,23,42,0.15)",
          }}
          animationDuration={200}
        />
      ) : null}

      {pendingPromotion && promoBox && (
        <div
          className="absolute z-20 flex flex-col overflow-hidden rounded-sm border border-ink-900/40 bg-white shadow-lg"
          style={{
            left: `${promoBox.left}%`,
            top: `${promoBox.top}%`,
            width: `${promoBox.width}%`,
            height: `${promoBox.height}%`,
          }}
        >
          {promoPieces.map((opt) => (
            <button
              key={opt.p}
              type="button"
              className="flex flex-1 items-center justify-center bg-[#f0d9b5] text-[clamp(1.1rem,4vw,1.7rem)] leading-none text-ink-900 hover:bg-gold/80"
              aria-label={`Превратить в ${opt.p}`}
              onClick={(e) => {
                e.stopPropagation();
                if (pendingPromotion.asPremove) {
                  queuePremove(pendingPromotion.from, pendingPromotion.to, opt.p);
                } else {
                  void attemptMove(pendingPromotion.from, pendingPromotion.to, opt.p);
                }
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
