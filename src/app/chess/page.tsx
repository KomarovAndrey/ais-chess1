"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Button } from "@/components/ui/button";

type DifficultyLevel = 1 | 2 | 3 | 4 | 5;
type PlayerColor = "white" | "black";

function ChessPageContent() {
  const searchParams = useSearchParams();
  const colorParam = searchParams.get("color");
  const levelParam = searchParams.get("level");
  const timeParam = searchParams.get("time");

  const initialColor: PlayerColor =
    colorParam === "black" ? "black" : colorParam === "white" ? "white" : "white";
  const initialLevel: DifficultyLevel =
    levelParam && [1, 2, 3, 4, 5].includes(Number(levelParam))
      ? (Number(levelParam) as DifficultyLevel)
      : 3;
  const timePerSideSeconds = timeParam && Number(timeParam) > 0 ? Number(timeParam) : 0;
  const initialTimeMs = timePerSideSeconds * 1000;

  const [game] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());
  const [playerColor, setPlayerColor] = useState<PlayerColor>(initialColor);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(initialLevel);
  const [status, setStatus] = useState<string>("Ваш ход");
  const [initialized, setInitialized] = useState(false);
  const [whiteTimeMs, setWhiteTimeMs] = useState(initialTimeMs);
  const [blackTimeMs, setBlackTimeMs] = useState(initialTimeMs);
  const [gameOverByTime, setGameOverByTime] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (initialized) return;
    setPlayerColor(initialColor);
    setDifficulty(initialLevel);
    setWhiteTimeMs(initialTimeMs);
    setBlackTimeMs(initialTimeMs);
    setStatus(initialColor === "white" ? "Ваш ход" : "Ход компьютера");
    setInitialized(true);
  }, [initialColor, initialLevel, initialized, initialTimeMs]);

  const isPlayerTurn = useMemo(() => {
    const turn = game.turn();
    return (turn === "w" && playerColor === "white") || (turn === "b" && playerColor === "black");
  }, [game, playerColor, fen]);

  const whiteClockRuns = game.turn() === "w";
  const blackClockRuns = game.turn() === "b";

  useEffect(() => {
    if (!isPlayerTurn && !game.isGameOver() && !gameOverByTime) {
      const timer = setTimeout(() => {
        makeAIMove();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPlayerTurn, fen, gameOverByTime]);

  useEffect(() => {
    if (initialTimeMs <= 0 || game.isGameOver() || gameOverByTime) return;
    const interval = setInterval(() => {
      if (whiteClockRuns) {
        setWhiteTimeMs((w) => {
          if (w <= 0) return w;
          const next = w - 100;
          if (next <= 0) {
            setGameOverByTime(true);
            setStatus("Время белых вышло. Победили чёрные.");
          }
          return next;
        });
      } else if (blackClockRuns) {
        setBlackTimeMs((b) => {
          if (b <= 0) return b;
          const next = b - 100;
          if (next <= 0) {
            setGameOverByTime(true);
            setStatus("Время чёрных вышло. Победили белые.");
          }
          return next;
        });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [whiteClockRuns, blackClockRuns, initialTimeMs, gameOverByTime]);

  function goToNewGame() {
    router.push("/?open=cpu");
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

  const pieceValues: Record<string, number> = useMemo(
    () => ({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }),
    []
  );

  function makeAIMove() {
    if (game.isGameOver() || gameOverByTime) return;
    if (initialTimeMs > 0 && (whiteTimeMs <= 0 || blackTimeMs <= 0)) return;
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return;

    let chosenMove = moves[0];

    if (difficulty === 1) {
      chosenMove = moves[Math.floor(Math.random() * moves.length)];
    } else if (difficulty === 2) {
      const captures = moves.filter((m) => m.captured);
      chosenMove =
        captures[Math.floor(Math.random() * captures.length)] ??
        moves[Math.floor(Math.random() * moves.length)];
    } else if (difficulty === 3) {
      const captures = moves.filter((m) => m.captured);
      chosenMove =
        captures[Math.floor(Math.random() * captures.length)] ??
        moves[Math.floor(Math.random() * moves.length)];
    } else if (difficulty === 4 || difficulty === 5) {
      let bestScore = -Infinity;
      const candidates: typeof moves = [];
      for (const m of moves) {
        const score = m.captured ? pieceValues[m.captured.toLowerCase()] ?? 0 : 0;
        if (score > bestScore) {
          bestScore = score;
          candidates.length = 0;
          candidates.push(m);
        } else if (score === bestScore && score > 0) {
          candidates.push(m);
        }
      }
      if (difficulty === 5 && candidates.length > 0) {
        chosenMove = candidates[Math.floor(Math.random() * candidates.length)];
      } else if (candidates.length > 0) {
        chosenMove = candidates[0];
      } else {
        chosenMove = moves[Math.floor(Math.random() * moves.length)];
      }
    }

    game.move(chosenMove);
    setFen(game.fen());
    updateStatus();
  }

  function formatMs(ms: number) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function onDrop(sourceSquare: string, targetSquare: string) {
    if (!isPlayerTurn || game.isGameOver() || gameOverByTime) return false;
    if (initialTimeMs > 0 && (whiteTimeMs <= 0 || blackTimeMs <= 0)) return false;

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

          {initialTimeMs > 0 && (
            <div className="mb-3 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-2 text-sm font-mono text-white">
              <span>Чёрные</span>
              <span className="text-lg">{formatMs(blackTimeMs)}</span>
            </div>
          )}

          <div className="aspect-square max-h-[480px] w-full max-w-[480px] mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              boardOrientation={playerColor}
              customDarkSquareStyle={{ backgroundColor: "#b58863" }}
              customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
              customBoardStyle={{
                borderRadius: "1.5rem",
                boxShadow: "0 15px 40px rgba(15,23,42,0.15)"
              }}
            />
          </div>

          {initialTimeMs > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-2 text-sm font-mono text-white">
              <span>Белые</span>
              <span className="text-lg">{formatMs(whiteTimeMs)}</span>
            </div>
          )}

          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {status}
          </div>
        </section>

        <aside className="w-full max-w-md space-y-4 md:w-80">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-md">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={goToNewGame}
            >
              Новая партия
            </Button>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default function ChessPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 via-white to-orange-50">
        <p className="text-slate-600">Загрузка...</p>
      </main>
    }>
      <ChessPageContent />
    </Suspense>
  );
}

