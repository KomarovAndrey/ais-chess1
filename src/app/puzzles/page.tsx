"use client";

import { useState, useCallback } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Puzzle as PuzzleIcon, RotateCcw } from "lucide-react";
import Link from "next/link";
import { PUZZLES, getPuzzleByIndex, getRandomPuzzleIndex } from "@/lib/puzzles-data";

function uciFromSquares(from: string, to: string, promotion?: string): string {
  if (promotion) return from + to + promotion.toLowerCase();
  return from + to;
}

export default function PuzzlesPage() {
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [message, setMessage] = useState<"correct" | "wrong" | null>(null);
  const [key, setKey] = useState(0);

  const puzzle = getPuzzleByIndex(puzzleIndex) ?? PUZZLES[0];
  const expectedUci = puzzle.moves[0]?.toLowerCase();

  const onDrop = useCallback(
    (sourceSquare: string, targetSquare: string, piece: string): boolean => {
      const promo = piece === "p" || piece === "P" ? "q" : undefined;
      const uci = uciFromSquares(sourceSquare, targetSquare, promo);
      if (uci.toLowerCase() === expectedUci) {
        setMessage("correct");
        setCorrectCount((c) => c + 1);
        setMessage("correct");
        setTimeout(() => {
          setMessage(null);
          let next = puzzleIndex + 1;
          if (next >= PUZZLES.length) next = getRandomPuzzleIndex(puzzleIndex);
          setPuzzleIndex(next);
          setKey((k) => k + 1);
        }, 600);
        return true;
      }
      setMessage("wrong");
      setWrongCount((c) => c + 1);
      setTimeout(() => setMessage(null), 1500);
      return false;
    },
    [expectedUci, puzzleIndex]
  );

  const resetCurrent = useCallback(() => {
    setKey((k) => k + 1);
    setMessage(null);
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-orange-50 px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← На главную
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <PuzzleIcon className="h-6 w-6 text-violet-600" />
            Головоломки
          </h1>
          <div className="w-20 text-right text-sm text-slate-500">
            {correctCount} / {correctCount + wrongCount || "—"}
          </div>
        </div>

        <p className="mb-4 text-center text-sm text-slate-600">
          Найдите лучший ход. Позиция {puzzleIndex + 1} из {PUZZLES.length}
          {puzzle.theme ? ` · ${puzzle.theme}` : ""}
        </p>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div
            key={key}
            role="img"
            aria-label="Шахматная доска. Найдите лучший ход."
            className="mx-auto overflow-hidden border border-slate-200 bg-slate-100"
            style={{
              width: "min(100vw - 2rem, 70vh, 480px)",
              height: "min(100vw - 2rem, 70vh, 480px)",
              touchAction: "manipulation"
            }}
          >
            <Chessboard
              key={key}
              position={puzzle.fen}
              onPieceDrop={onDrop}
              boardOrientation={
                puzzle.fen.split(" ")[1] === "b" ? "black" : "white"
              }
              customDarkSquareStyle={{ backgroundColor: "#b58863" }}
              customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
              customBoardStyle={{
                borderRadius: 0,
                boxShadow: "0 10px 30px rgba(15,23,42,0.1)"
              }}
            />
          </div>

          {message === "correct" && (
            <p className="mt-4 text-center text-lg font-semibold text-green-600">
              Правильно!
            </p>
          )}
          {message === "wrong" && (
            <p className="mt-4 text-center text-lg font-semibold text-red-600">
              Неверно. Попробуйте ещё.
            </p>
          )}

          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={resetCurrent}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <RotateCcw className="h-4 w-4" />
              Заново
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
