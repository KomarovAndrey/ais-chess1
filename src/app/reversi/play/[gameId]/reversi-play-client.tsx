"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getValidMoves, countPieces, type Board } from "@/lib/reversi";

const BOARD_SIZE = 8;
const CELL_SIZE = 44;
const GRID_GAP = 2;
const GRID_PADDING = 4;
const BOARD_WRAPPER_SIZE = BOARD_SIZE * CELL_SIZE + (BOARD_SIZE - 1) * GRID_GAP + 2 * GRID_PADDING + 4;

type GameState = {
  id: string;
  status: string;
  board: Board;
  turn: "black" | "white";
  winner: string | null;
  black_player_id?: string | null;
  white_player_id?: string | null;
};

const INITIAL_BOARD: Board = [
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, "white", "black", null, null, null],
  [null, null, null, "black", "white", null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
];

export default function ReversiPlayClient({
  gameId,
  initialGame,
}: {
  gameId: string;
  initialGame: { id: string; status: string; board: unknown; turn: string; winner: string | null } | null;
}) {
  const [game, setGame] = useState<GameState | null>(() =>
    initialGame
      ? {
          ...initialGame,
          board: (initialGame.board as Board) ?? INITIAL_BOARD,
          turn: (initialGame.turn as "black" | "white") ?? "black",
        }
      : null
  );
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [mySide, setMySide] = useState<"black" | "white" | null>(null);
  const [joining, setJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let id = typeof window !== "undefined" ? localStorage.getItem("ais_reversi_player_id") : null;
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("ais_reversi_player_id", id);
    }
    setPlayerId(id);
  }, []);

  useEffect(() => {
    if (!playerId || !gameId) return;
    let cancelled = false;

    async function ensureJoined() {
      const res = await fetch(`/api/reversi/${gameId}`);
      const data = await res.json().catch(() => null);
      if (cancelled) return;
      if (data?.id) {
        setGame((prev) => ({
          ...data,
          board: (data.board as Board) ?? INITIAL_BOARD,
          turn: data.turn ?? "black",
        }));
        if (data.black_player_id === playerId) setMySide("black");
        else if (data.white_player_id === playerId) setMySide("white");
        else if (data.status === "waiting") {
          const joinRes = await fetch("/api/reversi/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gameId, playerId }),
          });
          const joinData = await joinRes.json().catch(() => ({}));
          if (cancelled) return;
          if (joinRes.ok && joinData.game) {
            setGame((prev) => ({
              ...joinData.game,
              board: (joinData.game.board as Board) ?? INITIAL_BOARD,
              turn: joinData.game.turn ?? "black",
            }));
            setMySide(joinData.player?.side ?? null);
          } else {
            setError(joinData.error ?? "Не удалось присоединиться");
          }
        }
      } else {
        setError("Игра не найдена");
      }
      setJoining(false);
    }

    ensureJoined();
    return () => {
      cancelled = true;
    };
  }, [gameId, playerId]);

  useEffect(() => {
    if (!gameId || !game) return;
    const isWaiting = game.status === "waiting";
    const isActiveNotMyTurn = game.status === "active" && mySide && game.turn !== mySide;
    if (!isWaiting && !isActiveNotMyTurn) return;
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/reversi/${gameId}`);
      const data = await res.json().catch(() => null);
      if (data?.id && data.status) {
        setGame((prev) =>
          prev
            ? {
                ...prev,
                ...data,
                board: (data.board as Board) ?? prev.board,
                turn: data.turn ?? prev.turn,
              }
            : null
        );
      }
    }, 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [gameId, game?.status, game?.turn, mySide]);

  const handleMove = useCallback(
    async (r: number, c: number) => {
      if (!playerId || !game || game.status !== "active" || game.turn !== mySide) return;
      setError(null);
      const res = await fetch(`/api/reversi/${gameId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, row: r, col: c }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.game) {
        setGame((prev) =>
          prev
            ? {
                ...prev,
                ...data.game,
                board: (data.game.board as Board) ?? prev.board,
                turn: data.game.turn ?? prev.turn,
                status: data.game.status ?? prev.status,
                winner: data.game.winner ?? prev.winner,
              }
            : null
        );
      } else {
        setError((data as { error?: string }).error ?? "Ход не принят");
      }
    },
    [gameId, playerId, game, mySide]
  );

  if (joining || !playerId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-600">Подключение…</p>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-600">{error}</p>
        <Link href="/reversi" className="text-sm text-slate-600 underline hover:text-slate-900">
          Назад к Reversi
        </Link>
      </div>
    );
  }

  const board = game?.board ?? INITIAL_BOARD;
  const validMoves = game && game.status === "active" && mySide === game.turn ? getValidMoves(board, game.turn) : [];
  const { black, white } = countPieces(board);
  const isMyTurn = game?.status === "active" && mySide === game?.turn;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/reversi" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Reversi
        </Link>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(typeof window !== "undefined" ? window.location.href : "").catch(() => {});
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Копировать ссылку
        </button>
      </div>

      {game?.status === "waiting" && (
        <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-center">
          <p className="font-semibold text-amber-900">Ожидаем соперника</p>
          <p className="mt-1 text-sm text-amber-800">Отправьте ссылку на эту страницу второму игроку.</p>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
        <div className="flex gap-6">
          <span className="text-sm font-semibold text-slate-800">
            Чёрные: <span className="text-amber-600">{black}</span>
            {mySide === "black" && <span className="ml-1 text-xs text-slate-500">(вы)</span>}
          </span>
          <span className="text-sm font-semibold text-slate-800">
            Белые: <span className="text-slate-400">{white}</span>
            {mySide === "white" && <span className="ml-1 text-xs text-slate-500">(вы)</span>}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          {game?.status === "finished"
            ? game.winner === "draw"
              ? "Ничья"
              : `Победили ${game.winner === "black" ? "чёрные" : "белые"}`
            : isMyTurn
              ? "Ваш ход"
              : "Ход соперника"}
        </p>
      </div>

      <div
        className="inline-block rounded-2xl border-2 border-slate-400 bg-green-800 shadow-lg"
        style={{ width: BOARD_WRAPPER_SIZE, height: BOARD_WRAPPER_SIZE }}
      >
        <div
          className="grid gap-0.5 p-1"
          style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`, gridTemplateRows: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)` }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isValid = isMyTurn && validMoves.some(([mr, mc]) => mr === r && mc === c);
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => handleMove(r, c)}
                  disabled={!isMyTurn || !isValid}
                  className="flex h-11 w-11 items-center justify-center rounded-md bg-green-700 transition hover:bg-green-600 disabled:cursor-default disabled:opacity-100"
                >
                  {cell === "black" && (
                    <span className="h-8 w-8 rounded-full shadow-md bg-gray-800" />
                  )}
                  {cell === "white" && (
                    <span className="h-8 w-8 rounded-full shadow-md bg-gray-100" />
                  )}
                  {!cell && isValid && <span className="h-2 w-2 rounded-full bg-slate-400/60" />}
                </button>
              );
            })
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {game?.status === "finished" && (
        <div className="mt-4 text-center">
          <Link
            href="/reversi"
            className="inline-block rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Новая игра
          </Link>
        </div>
      )}
    </div>
  );
}
