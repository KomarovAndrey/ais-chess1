"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Cpu, X, ChevronLeft, ChevronRight, SkipBack, SkipForward, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CPU_LEVEL_DESCRIPTIONS, CPU_PERSONAS } from "@/lib/cpu-levels";

const TIME_OPTIONS = [
  { seconds: 180, label: "3 мин" },
  { seconds: 300, label: "5 мин" },
  { seconds: 600, label: "10 мин" },
  { seconds: 900, label: "15 мин" },
];

const SIDE_OPTIONS: { id: "white" | "black" | "random"; label: string; icon: string }[] = [
  { id: "black", label: "Чёрные", icon: "♚" },
  { id: "random", label: "Случайный цвет", icon: "♔♚" },
  { id: "white", label: "Белые", icon: "♔" },
];

const CPU_LEVELS = [1, 2, 3, 4, 5] as const;

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
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [modalTime, setModalTime] = useState(300);
  const [modalColor, setModalColor] = useState<"white" | "black" | "random">("random");
  const [modalLevel, setModalLevel] = useState<DifficultyLevel>(3);
  /** Replay step for finished game: 0 = start, history.length = end. */
  const [replayStep, setReplayStep] = useState(0);
  const router = useRouter();

  const gameOver = game.isGameOver() || gameOverByTime;
  const history = game.history();
  const fenAtStepLocal = (step: number) => {
    if (step <= 0) return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const c = new Chess();
    const slice = history.slice(0, step);
    for (const san of slice) {
      const m = c.move(san);
      if (!m) break;
    }
    return c.fen();
  };
  const displayFen = gameOver && history.length > 0
    ? fenAtStepLocal(replayStep)
    : fen;

  useEffect(() => {
    if (gameOver && history.length > 0 && replayStep === 0) {
      setReplayStep(history.length);
    }
  }, [gameOver, history.length, replayStep]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setShowNewGameModal(false);
  }, []);

  useEffect(() => {
    if (showNewGameModal) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [showNewGameModal, handleKeyDown]);

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

  function openNewGameModal() {
    setShowNewGameModal(true);
  }

  function startNewGame() {
    const color =
      modalColor === "random" ? (Math.random() < 0.5 ? "white" : "black") : modalColor;
    router.push(`/chess?color=${color}&level=${modalLevel}&time=${modalTime}`);
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

          <div
            role="img"
            aria-label="Шахматная доска. Игра с компьютером. Текущая позиция."
            className="mx-auto overflow-hidden border border-slate-200 bg-slate-100"
            style={{
              width: "min(100vw - 2rem, 70vh, 480px)",
              height: "min(100vw - 2rem, 70vh, 480px)",
              touchAction: "manipulation"
            }}
          >
            <Chessboard
              position={displayFen}
              onPieceDrop={gameOver ? undefined : onDrop}
              boardOrientation={playerColor}
              customDarkSquareStyle={{ backgroundColor: "#b58863" }}
              customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
              customBoardStyle={{
                borderRadius: 0,
                boxShadow: "0 15px 40px rgba(15,23,42,0.15)"
              }}
            />
          </div>
          {history.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <p
                className="text-sm text-slate-600"
                aria-live="polite"
                aria-atomic="true"
              >
                {gameOver
                  ? (replayStep > 0 ? `Ход ${replayStep}: ${history[replayStep - 1] ?? ""}` : "Начальная позиция")
                  : `Последний ход: ${history[history.length - 1] ?? ""}`}
              </p>
            </div>
          )}

          {initialTimeMs > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-2 text-sm font-mono text-white">
              <span>Белые</span>
              <span className="text-lg">{formatMs(whiteTimeMs)}</span>
            </div>
          )}

          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {status}
          </div>

          {gameOver && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Итог партии</h3>
              <p className="text-slate-700">{status}</p>
              {history.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">Партия заняла {history.length} ходов.</p>
              )}
              <button
                type="button"
                onClick={openNewGameModal}
                className="mt-3 inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Новая партия
              </button>
            </div>
          )}

          {gameOver && history.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Просмотр партии</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReplayStep(0)}
                  disabled={replayStep === 0}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  aria-label="В начало"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setReplayStep((s) => Math.max(0, s - 1))}
                  disabled={replayStep === 0}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  aria-label="Назад"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[4rem] text-center text-sm text-slate-600">
                  {replayStep} / {history.length}
                </span>
                <button
                  type="button"
                  onClick={() => setReplayStep((s) => Math.min(history.length, s + 1))}
                  disabled={replayStep === history.length}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  aria-label="Вперёд"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setReplayStep(history.length)}
                  disabled={replayStep === history.length}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  aria-label="В конец"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const result = game.isCheckmate()
                      ? (game.turn() === "w" ? "0-1" : "1-0")
                      : game.isDraw()
                        ? "1/2-1/2"
                        : "1/2-1/2";
                    const pgnBody = game.pgn();
                    const headers = [
                      `[Event "AIS Chess"]`,
                      `[Site "?"]`,
                      `[Date "${new Date().toISOString().slice(0, 10).replace(/-/g, ".")}"]`,
                      `[White "${playerColor === "white" ? "Вы" : "Компьютер"}"]`,
                      `[Black "${playerColor === "black" ? "Вы" : "Компьютер"}"]`,
                      `[Result "${result}"]`,
                      ""
                    ].join("\n");
                    const blob = new Blob([headers + pgnBody], { type: "application/x-chess-pgn" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "ais-chess-vs-cpu.pgn";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="ml-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <Download className="h-4 w-4" />
                  Скачать PGN
                </button>
              </div>
            </div>
          )}

        </section>

        <aside className="w-full max-w-md space-y-4 md:w-80">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-md">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={openNewGameModal}
            >
              Новая партия
            </Button>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Уровень {difficulty}: {CPU_PERSONAS[difficulty].name}
            </p>
            <p className="mt-1 text-sm text-slate-600">{CPU_LEVEL_DESCRIPTIONS[difficulty]}</p>
          </div>
        </aside>
      </div>

      {showNewGameModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewGameModal(false);
          }}
        >
          <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setShowNewGameModal(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="px-6 pt-6 pb-2">
              <h3 className="text-center text-xl font-semibold tracking-wide text-slate-900">
                Новая партия
              </h3>
            </div>
            <div className="px-6 pb-6 pt-2 space-y-6">
              <div>
                <p className="mb-3 text-center text-sm font-medium text-slate-600">
                  Минут на партию
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.seconds}
                      type="button"
                      onClick={() => setModalTime(opt.seconds)}
                      className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${
                        modalTime === opt.seconds
                          ? "border-2 border-blue-600 bg-blue-600 text-white shadow-md"
                          : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-center text-sm font-medium text-slate-600">
                  Сторона
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SIDE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setModalColor(opt.id)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-4 text-sm font-medium transition ${
                        modalColor === opt.id
                          ? "border-2 border-blue-600 bg-blue-600 text-white shadow-md"
                          : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-2xl leading-none">{opt.icon}</span>
                      <span className="text-xs">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-center text-sm font-medium text-slate-600">
                  Уровень сложности
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {CPU_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setModalLevel(level)}
                      className={`flex flex-col rounded-xl border px-2 py-3 text-sm font-bold transition ${
                        modalLevel === level
                          ? "border-2 border-blue-600 bg-blue-600 text-white shadow-md"
                          : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                      title={CPU_PERSONAS[level].name + " — " + CPU_PERSONAS[level].style}
                    >
                      <span>{level}</span>
                      <span className="mt-0.5 truncate text-[10px] font-normal opacity-90">
                        {CPU_PERSONAS[level].name}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-center text-xs text-slate-500">
                  {CPU_LEVEL_DESCRIPTIONS[modalLevel]}
                </p>
              </div>
              <button
                type="button"
                onClick={startNewGame}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-orange-500 px-4 py-4 text-base font-semibold text-white shadow-md transition hover:bg-orange-600"
              >
                <Cpu className="h-5 w-5 shrink-0" />
                Сыграть с компьютером
              </button>
            </div>
          </div>
        </div>
      )}
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

