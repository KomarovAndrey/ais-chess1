"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Difficulty = "easy" | "medium" | "hard";
type PlayerColor = "white" | "black";

const customPieces: Record<string, (props: { squareWidth: number }) => JSX.Element> = {
  wP: ({ squareWidth }) => (
    <div
      style={{
        width: squareWidth,
        height: squareWidth,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: squareWidth * 0.6,
        fontWeight: 700,
        color: "#ffffff",
        textShadow: "0 0 3px rgba(0,0,0,0.8)",
      }}
    >
      P
    </div>
  ),
  wN: ({ squareWidth }) => (
    <div
      style={{
        width: squareWidth,
        height: squareWidth,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: squareWidth * 0.6,
        fontWeight: 700,
        color: "#ffffff",
        textShadow: "0 0 3px rgba(0,0,0,0.8)",
      }}
    >
      N
    </div>
  ),
  wB: ({ squareWidth }) => (
    <div
      style={{
        width: squareWidth,
        height: squareWidth,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: squareWidth * 0.6,
        fontWeight: 700,
        color: "#ffffff",
        textShadow: "0 0 3px rgba(0,0,0,0.8)",
      }}
    >
      B
    </div>
  ),
  wR: ({ squareWidth }) => (
    <div
      style={{
        width: squareWidth,
        height: squareWidth,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: squareWidth * 0.6,
        fontWeight: 700,
        color: "#ffffff",
        textShadow: "0 0 3px rgba(0,0,0,0.8)",
      }}
    >
      R
    </div>
  ),
  wQ: ({ squareWidth }) => (
    <div
      style={{
        width: squareWidth,
        height: squareWidth,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: squareWidth * 0.6,
        fontWeight: 700,
        color: "#ffffff",
        textShadow: "0 0 3px rgba(0,0,0,0.8)",
      }}
    >
      Q
    </div>
  ),
  wK: ({ squareWidth }) => (
    <div
      style={{
        width: squareWidth,
        height: squareWidth,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: squareWidth * 0.6,
        fontWeight: 700,
        color: "#ffffff",
        textShadow: "0 0 3px rgba(0,0,0,0.8)",
      }}
    >
      K
    </div>
  ),
  bP: ({ squareWidth }) => (
    <div
      style={{
        width: squareWidth,
        height: squareWidth,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: squareWidth * 0.6,
        fontWeight: 700,
        color: "#000000",
        textShadow: "0 0 3px rgba(255,255,255,0.8)",
      }}
    >
      P
    </div>
  ),
  bN: ({ squareWidth }) => (
    <div
      style={{
        width: squareWidth,
        height: squareWidth,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: squareWidth * 0.6,
        fontWeight: 700,
        color: "#000000",
        textShadow: "0 0 3px rgba(255,255,255,0.8)",
      }}
    >
      N
    </div>
  ),
  bB: ({ squareWidth }) => (
    <div
      style={{
        width: squareWidth,
        height: squareWidth,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: squareWidth * 0.6,
        fontWeight: 700,
        color: "#000000",
        textShadow: "0 0 3px rgba(255,255,255,0.8)",
      }}
    >
      B
    </div>
  ),
  bR: ({ squareWidth }) => (
    <div
      style={{
        width: squareWidth,
        height: squareWidth,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: squareWidth * 0.6,
        fontWeight: 700,
        color: "#000000",
        textShadow: "0 0 3px rgba(255,255,255,0.8)",
      }}
    >
      R
    </div>
  ),
  bQ: ({ squareWidth }) => (
    <div
      style={{
        width: squareWidth,
        height: squareWidth,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: squareWidth * 0.6,
        fontWeight: 700,
        color: "#000000",
        textShadow: "0 0 3px rgba(255,255,255,0.8)",
      }}
    >
      Q
    </div>
  ),
  bK: ({ squareWidth }) => (
    <div
      style={{
        width: squareWidth,
        height: squareWidth,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: squareWidth * 0.6,
        fontWeight: 700,
        color: "#000000",
        textShadow: "0 0 3px rgba(255,255,255,0.8)",
      }}
    >
      K
    </div>
  ),
};

export default function ChessPage() {
  const [game] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());
  const [playerColor, setPlayerColor] = useState<PlayerColor>("white");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [status, setStatus] = useState<string>("Ваш ход");

  const isPlayerTurn = useMemo(() => {
    const turn = game.turn();
    return (turn === "w" && playerColor === "white") || (turn === "b" && playerColor === "black");
  }, [game, playerColor, fen]);

  useEffect(() => {
    if (!isPlayerTurn && !game.isGameOver()) {
      const timer = setTimeout(() => {
        makeAIMove();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPlayerTurn, fen]);

  function resetGame(color: PlayerColor) {
    game.reset();
    setPlayerColor(color);
    setFen(game.fen());
    setStatus(color === "white" ? "Ваш ход" : "Ход компьютера");
  }

  function updateStatus() {
    if (game.isCheckmate()) {
      setStatus(game.turn() === "w" ? "Шах и мат. Чёрные выиграли." : "Шах и мат. Белые выиграли.");
    } else if (game.isDraw()) {
      setStatus("Ничья.");
    } else if (game.isCheck()) {
      setStatus("Шах! Будьте внимательны.");
    } else {
      setStatus(isPlayerTurn ? "Ваш ход" : "Ход компьютера");
    }
  }

  function makeAIMove() {
    if (game.isGameOver()) return;
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return;

    let chosenMove = moves[0];

    if (difficulty === "easy") {
      chosenMove = moves[Math.floor(Math.random() * moves.length)];
    } else if (difficulty === "medium") {
      // предпочитаем взятия
      const captures = moves.filter((m) => m.captured);
      chosenMove =
        captures[Math.floor(Math.random() * captures.length)] ??
        moves[Math.floor(Math.random() * moves.length)];
    } else if (difficulty === "hard") {
      // очень простой "оценщик": считаем ценность взятой фигуры
      const values: Record<string, number> = {
        p: 1,
        n: 3,
        b: 3,
        r: 5,
        q: 9,
        k: 100
      };
      let bestScore = -Infinity;
      for (const m of moves) {
        const score = m.captured ? values[m.captured.toLowerCase()] ?? 0 : 0;
        if (score > bestScore) {
          bestScore = score;
          chosenMove = m;
        }
      }
    }

    game.move(chosenMove);
    setFen(game.fen());
    updateStatus();
  }

  function onDrop(sourceSquare: string, targetSquare: string) {
    if (!isPlayerTurn || game.isGameOver()) return false;

    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q"
    });

    if (move === null) return false;

    setFen(game.fen());
    updateStatus();
    return true;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-orange-50 px-4 py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 md:flex-row">
        <section className="flex-1 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-lg backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-lg font-bold text-slate-900 md:text-xl">
              Игра с компьютером
            </h1>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              AIS Chess
            </span>
          </div>

          <div className="aspect-square max-h-[480px] w-full max-w-[480px] mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              boardOrientation={playerColor}
              customDarkSquareStyle={{ backgroundColor: "#b58863" }}
              customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
              customPieces={customPieces}
              customBoardStyle={{
                borderRadius: "1.5rem",
                boxShadow: "0 15px 40px rgba(15,23,42,0.15)"
              }}
            />
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {status}
          </div>
        </section>

        <aside className="w-full max-w-md space-y-4 md:w-80">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-md">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Цвет фигур
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => resetGame("white")}
                className={cn(
                  "rounded-2xl border px-3 py-2 text-sm font-medium transition",
                  playerColor === "white"
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                )}
              >
                Белыми (первый ход)
              </button>
              <button
                type="button"
                onClick={() => resetGame("black")}
                className={cn(
                  "rounded-2xl border px-3 py-2 text-sm font-medium transition",
                  playerColor === "black"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                )}
              >
                Чёрными
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-md">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Уровень сложности
            </h2>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { id: "easy", label: "Лёгкий" },
                { id: "medium", label: "Средний" },
                { id: "hard", label: "Сложный" }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDifficulty(opt.id as Difficulty)}
                  className={cn(
                    "rounded-2xl border px-3 py-2 font-medium transition",
                    difficulty === opt.id
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Сейчас ИИ простой: чем выше уровень, тем больше он ценит выгодные
              взятия. В будущем можно улучшить логику и добавить таймер.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-md">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Партия
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => resetGame(playerColor)}
              >
                Новая партия
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.assign("/")}
              >
                На главную
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Для учебных партий в школе можно играть с одного экрана, меняя
              цвет и сложность.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

