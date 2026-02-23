"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  createInitialBoard,
  getValidMoves,
  makeMove,
  countPieces,
  getWinner,
  type Board,
} from "@/lib/reversi";

const BOARD_SIZE = 8;
const CELL_SIZE = 44;

export default function ReversiPage() {
  const [board, setBoard] = useState<Board>(() => createInitialBoard());
  const [turn, setTurn] = useState<"black" | "white">("black");
  const [vsCpu, setVsCpu] = useState(false);

  const validMoves = getValidMoves(board, turn);
  const winner = getWinner(board);
  const { black, white } = countPieces(board);

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (winner) return;
      const next = makeMove(board, r, c, turn);
      if (!next) return;
      setBoard(next);
      const nextTurn = turn === "black" ? "white" : "black";
      const nextValid = getValidMoves(next, nextTurn);
      if (nextValid.length > 0) {
        setTurn(nextTurn);
      } else {
        const skipValid = getValidMoves(next, turn);
        if (skipValid.length > 0) {
          setTurn(turn);
        } else {
          setTurn(nextTurn);
        }
      }
    },
    [board, turn, winner]
  );

  useEffect(() => {
    if (!vsCpu || winner || turn !== "white") return;
    const moves = getValidMoves(board, "white");
    if (moves.length === 0) return;
    const [r, c] = moves[Math.floor(Math.random() * moves.length)];
    const next = makeMove(board, r, c, "white");
    if (!next) return;
    setBoard(next);
    const nextTurn = "black";
    const nextValid = getValidMoves(next, nextTurn);
    setTurn(nextValid.length > 0 ? nextTurn : "white");
  }, [vsCpu, turn, winner, board]);

  useEffect(() => {
    if (winner || validMoves.length > 0) return;
    setTurn((t) => (t === "black" ? "white" : "black"));
  }, [winner, validMoves.length]);

  const startNewGame = useCallback(() => {
    setBoard(createInitialBoard());
    setTurn("black");
  }, []);

  const statusText = winner
    ? winner === "draw"
      ? "Ничья!"
      : winner === "black"
        ? "Победили чёрные"
        : "Победили белые"
    : validMoves.length === 0
      ? `Нет ходов. Ход переходит ${turn === "black" ? "белым" : "чёрным"}.`
      : `Ход: ${turn === "black" ? "Чёрные" : "Белые"}`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 via-white to-emerald-50 px-4 py-6">
      <div className="mx-auto max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← На главную
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Reversi</h1>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
          <div className="flex gap-6">
            <span className="text-sm font-semibold text-slate-800">
              Чёрные: <span className="text-amber-600">{black}</span>
            </span>
            <span className="text-sm font-semibold text-slate-800">
              Белые: <span className="text-slate-400">{white}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={vsCpu}
                onChange={(e) => setVsCpu(e.target.checked)}
                className="rounded border-slate-300"
              />
              vs CPU
            </label>
            <button
              type="button"
              onClick={startNewGame}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Новая игра
            </button>
          </div>
        </div>

        <div
          className="inline-block overflow-hidden rounded-2xl border-2 border-slate-400 bg-green-800 shadow-lg"
          style={{ width: BOARD_SIZE * CELL_SIZE + 8, height: BOARD_SIZE * CELL_SIZE + 8 }}
        >
          <div className="grid gap-0.5 p-1" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)` }}>
            {board.map((row, r) =>
              row.map((cell, c) => {
                const isValid = !winner && validMoves.some(([mr, mc]) => mr === r && mc === c);
                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    onClick={() => handleCellClick(r, c)}
                    disabled={!!winner || !isValid}
                    className="flex h-11 w-11 items-center justify-center rounded-md bg-green-700 transition hover:bg-green-600 disabled:cursor-default disabled:opacity-100"
                  >
                    {cell === "black" && (
                      <span
                        className="h-8 w-8 rounded-full shadow-md"
                        style={{ backgroundColor: "#1f2937" }}
                      />
                    )}
                    {cell === "white" && (
                      <span
                        className="h-8 w-8 rounded-full shadow-md"
                        style={{ backgroundColor: "#f3f4f6" }}
                      />
                    )}
                    {!cell && isValid && (
                      <span className="h-2 w-2 rounded-full bg-slate-400/60" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <p className="mt-4 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-center text-sm text-slate-700">
          {statusText}
        </p>

        <p className="mt-4 text-center text-xs text-slate-500">
          Поставьте фишку так, чтобы между ней и своей другой фишкой оказалась линия фишек соперника — они перевернутся.
        </p>
      </div>
    </main>
  );
}
