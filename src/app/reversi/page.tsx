"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Cpu } from "lucide-react";
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
const GRID_GAP = 2;
const GRID_PADDING = 4;
const LABEL_SIZE = 24;
const COL_LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];
const BOARD_WRAPPER_SIZE = BOARD_SIZE * CELL_SIZE + (BOARD_SIZE - 1) * GRID_GAP + 2 * GRID_PADDING + 4;

export default function ReversiPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"choice" | "vsCpu">("choice");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [board, setBoard] = useState<Board>(() => createInitialBoard());
  const [turn, setTurn] = useState<"black" | "white">("black");
  const [vsCpu, setVsCpu] = useState(true);

  const validMoves = getValidMoves(board, turn);
  const winner = getWinner(board);
  const { black, white } = countPieces(board);

  const handleCreateByLink = useCallback(async () => {
    setCreateError(null);
    setCreating(true);
    let playerId = typeof window !== "undefined" ? localStorage.getItem("ais_reversi_player_id") : null;
    if (!playerId) {
      playerId = crypto.randomUUID();
      localStorage.setItem("ais_reversi_player_id", playerId);
    }
    try {
      const res = await fetch("/api/reversi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, creatorSide: "random" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Не удалось создать игру");
      const gameId = (data as { gameId?: string }).gameId;
      if (gameId && typeof window !== "undefined") {
        const url = `${window.location.origin}/reversi/play/${gameId}`;
        await navigator.clipboard.writeText(url).catch(() => {});
        router.push(`/reversi/play/${gameId}`);
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setCreating(false);
    }
  }, [router]);

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
        setTurn(skipValid.length > 0 ? turn : nextTurn);
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

  if (mode === "choice") {
    return (
      <main className="min-h-screen bg-gradient-to-b from-green-50 via-white to-emerald-50 px-4 py-6">
        <div className="mx-auto max-w-lg">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              ← На главную
            </Link>
            <h1 className="text-xl font-bold text-slate-900">Reversi</h1>
          </div>

          <div className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-md">
            <h2 className="mb-4 text-center text-lg font-semibold text-slate-900">Выберите режим</h2>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleCreateByLink}
                disabled={creating}
                className="flex items-center justify-center gap-3 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3.5 text-sm font-medium text-slate-100 shadow-sm transition hover:bg-slate-600 disabled:opacity-70"
              >
                <Link2 className="h-5 w-5 shrink-0 text-slate-300" />
                {creating ? "Создаём игру…" : "Игра по ссылке (онлайн)"}
              </button>
              <button
                type="button"
                onClick={() => setMode("vsCpu")}
                className="flex items-center justify-center gap-3 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3.5 text-sm font-medium text-slate-100 shadow-sm transition hover:bg-slate-600"
              >
                <Cpu className="h-5 w-5 shrink-0 text-slate-300" />
                С компьютером
              </button>
            </div>
            {createError && <p className="mt-3 text-center text-sm text-red-600">{createError}</p>}
          </div>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 via-white to-emerald-50 px-4 py-6">
      <div className="mx-auto max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMode("choice")}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Выбор режима
          </button>
          <h1 className="text-xl font-bold text-slate-900">Reversi — с компьютером</h1>
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
          <button
            type="button"
            onClick={startNewGame}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Новая игра
          </button>
        </div>

        {winner && (
          <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Итог партии</h3>
            <p className="mt-1 text-sm text-slate-700">
              {winner === "draw" ? "Ничья" : `Победили ${winner === "black" ? "чёрные" : "белые"}`}.
              Ниже — итоговая позиция для просмотра.
            </p>
          </div>
        )}

        <div className="inline-block rounded-2xl border-2 border-slate-400 bg-green-800 p-2 shadow-lg">
          <div className="flex flex-col gap-0.5">
            {board.map((row, r) => (
              <div key={r} className="flex items-center">
                <span
                  className="flex items-center justify-end pr-1 text-xs font-medium text-slate-200"
                  style={{ width: LABEL_SIZE, height: CELL_SIZE }}
                >
                  {r + 1}
                </span>
                <div className="flex gap-0.5">
                  {row.map((cell, c) => {
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
                          <span className="h-8 w-8 rounded-full shadow-md" style={{ backgroundColor: "#1f2937" }} />
                        )}
                        {cell === "white" && (
                          <span className="h-8 w-8 rounded-full shadow-md" style={{ backgroundColor: "#f3f4f6" }} />
                        )}
                        {!cell && isValid && <span className="h-2 w-2 rounded-full bg-slate-400/60" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex" style={{ marginLeft: LABEL_SIZE }}>
            {COL_LABELS.map((letter) => (
              <span
                key={letter}
                className="flex items-center justify-center pt-1 text-xs font-medium text-slate-200"
                style={{ width: CELL_SIZE }}
              >
                {letter}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-4 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-center text-sm text-slate-700">
          {statusText}
        </p>

      </div>
    </main>
  );
}
