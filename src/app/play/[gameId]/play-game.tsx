"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { supabase } from "@/lib/supabaseClient";

type GameStatus = "waiting" | "active" | "finished";

interface GameRow {
  id: string;
  status: GameStatus;
  fen: string;
  creator_color: "white" | "black" | "random";
  time_control_seconds: number;
  active_color: "w" | "b";
  started_at: string | null;
  winner: "white" | "black" | "draw" | null;
  white_time_left: number;
  black_time_left: number;
  last_move_at: string | null;
}

interface PlayerRow {
  id: string;
  side: "white" | "black";
  player_id: string;
  joined_at: string;
}

interface PlayGameProps {
  initialGame: GameRow;
}

function formatMs(ms: number) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function PlayGame({ initialGame }: PlayGameProps) {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;

  const [game] = useState(() => new Chess());
  const [gameRow, setGameRow] = useState<GameRow>(initialGame);
  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [whiteTime, setWhiteTime] = useState(initialGame.white_time_left);
  const [blackTime, setBlackTime] = useState(initialGame.black_time_left);

  const isMyTurn = useMemo(() => {
    if (!player) return false;
    const active = gameRow.active_color;
    return (active === "w" && player.side === "white") || (active === "b" && player.side === "black");
  }, [player, gameRow.active_color]);

  // Initialize local player id
  useEffect(() => {
    const existingId = window.localStorage.getItem("ais_chess_player_id");
    let id = existingId;
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem("ais_chess_player_id", id);
    }
    setPlayerId(id);
  }, []);

  // Join game on mount
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;

    async function join() {
      setIsJoining(true);
      setError(null);
      try {
        const res = await fetch("/api/games/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId, playerId })
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Не удалось подключиться к партии");
        }

        const data = await res.json();
        if (!cancelled) {
          setGameRow(data.game);
          setPlayer(data.player);
          setWhiteTime(data.game.white_time_left);
          setBlackTime(data.game.black_time_left);
          if (data.game.fen && data.game.fen !== "startpos") {
            game.load(data.game.fen);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message ?? "Ошибка подключения к партии");
        }
      } finally {
        if (!cancelled) {
          setIsJoining(false);
        }
      }
    }

    join();

    return () => {
      cancelled = true;
    };
  }, [playerId, gameId, game]);

  // Subscribe to realtime updates (Supabase Realtime)
  useEffect(() => {
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          const newGame = payload.new as GameRow;
          setGameRow(newGame);
          setWhiteTime(newGame.white_time_left);
          setBlackTime(newGame.black_time_left);
          if (newGame.fen) {
            game.load(newGame.fen);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, game]);

  // Polling fallback: refresh game state when waiting for opponent or for game to start
  // (board updates without page reload if Realtime is not enabled for table)
  useEffect(() => {
    const waitingForUpdate =
      player &&
      (gameRow.status === "waiting" || (gameRow.status === "active" && !isMyTurn));
    if (!waitingForUpdate) return;

    const poll = async () => {
      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (error || !data) return;
      const newGame = data as GameRow;
      setGameRow(newGame);
      setWhiteTime(newGame.white_time_left);
      setBlackTime(newGame.black_time_left);
      if (newGame.fen) {
        game.load(newGame.fen);
      }
    };

    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [player, gameId, gameRow.status, isMyTurn, game]);

  // Local ticking of clocks
  useEffect(() => {
    if (gameRow.status !== "active" || !gameRow.last_move_at) return;

    const lastMoveAt = new Date(gameRow.last_move_at).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastMoveAt;

      if (gameRow.active_color === "w") {
        setWhiteTime(gameRow.white_time_left - elapsed);
      } else {
        setBlackTime(gameRow.black_time_left - elapsed);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [gameRow.status, gameRow.last_move_at, gameRow.active_color, gameRow.white_time_left, gameRow.black_time_left]);

  const boardOrientation: "white" | "black" = player?.side ?? "white";

  const canMove =
    player &&
    gameRow.status === "active" &&
    isMyTurn &&
    whiteTime > 0 &&
    blackTime > 0;

  async function sendUpdate(opts: {
    fen: string;
    activeColor: "w" | "b";
    whiteTimeLeft: number;
    blackTimeLeft: number;
    status: GameStatus;
    winner?: "white" | "black" | "draw" | null;
  }) {
    const body = playerId ? { ...opts, playerId } : opts;
    await fetch(`/api/games/${gameId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  function onDrop(sourceSquare: string, targetSquare: string) {
    if (!canMove) return false;

    // Calculate effective remaining times before making move
    const now = Date.now();
    let currentWhite = whiteTime;
    let currentBlack = blackTime;

    if (gameRow.status === "active" && gameRow.last_move_at) {
      const elapsed = now - new Date(gameRow.last_move_at).getTime();
      if (gameRow.active_color === "w") {
        currentWhite = currentWhite - elapsed;
      } else {
        currentBlack = currentBlack - elapsed;
      }
    }

    if (currentWhite <= 0 || currentBlack <= 0) {
      // Time is up before move
      const loser = currentWhite <= 0 ? "white" : "black";
      const winner = loser === "white" ? "black" : "white";
      sendUpdate({
        fen: gameRow.fen,
        activeColor: gameRow.active_color,
        whiteTimeLeft: Math.max(currentWhite, 0),
        blackTimeLeft: Math.max(currentBlack, 0),
        status: "finished",
        winner
      });
      return false;
    }

    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q"
    });

    if (move === null) return false;

    const newFen = game.fen();

    // After move, switch active color
    const nextActive: "w" | "b" = game.turn();

    // Check for game end by rules
    let status: GameStatus = "active";
    let winner: "white" | "black" | "draw" | null = null;

    if (game.isGameOver()) {
      status = "finished";
      if (game.isCheckmate()) {
        winner = game.turn() === "w" ? "black" : "white";
      } else {
        winner = "draw";
      }
    }

    // If game still active, clocks continue, but we already updated times above
    sendUpdate({
      fen: newFen,
      activeColor: nextActive,
      whiteTimeLeft: currentWhite,
      blackTimeLeft: currentBlack,
      status,
      winner
    });

    setGameRow((prev) => ({
      ...prev,
      fen: newFen,
      active_color: nextActive,
      white_time_left: currentWhite,
      black_time_left: currentBlack,
      status
    }));

    setWhiteTime(currentWhite);
    setBlackTime(currentBlack);

    return true;
  }

  const statusText = (() => {
    if (!player) return "Подключаемся к партии...";
    if (gameRow.status === "waiting") {
      return "Ожидаем второго игрока. Отправьте ссылку другу.";
    }
    if (gameRow.status === "finished") {
      if (gameRow.winner === "draw") return "Игра завершена. Ничья.";
      if (gameRow.winner === "white") return "Игра завершена. Победили белые.";
      if (gameRow.winner === "black") return "Игра завершена. Победили чёрные.";
      return "Игра завершена.";
    }
    if (!isMyTurn) return "Ход соперника.";
    return "Ваш ход.";
  })();

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-orange-50 px-4 py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 md:flex-row">
        <section className="flex-1 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-lg backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900 md:text-xl">
                Онлайн-партия
              </h1>
              <p className="text-xs text-slate-500">
                Игра по ссылке без регистрации · {Math.floor(gameRow.time_control_seconds / 60)} мин на игрока
              </p>
            </div>
            <button
              type="button"
              className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow"
              onClick={() => {
                navigator.clipboard
                  .writeText(window.location.href)
                  .catch(() => {});
              }}
            >
              Скопировать ссылку
            </button>
          </div>

          {gameRow.status === "waiting" && (
            <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-amber-900">
                Ожидание соперника
              </p>
              <p className="mt-1 text-xs text-amber-800">
                Отправьте ссылку другу. Доска и таймер ниже — партия начнётся, когда он перейдёт по ссылке.
              </p>
            </div>
          )}

          <div className="mb-3 flex items-center justify-between text-xs font-medium text-slate-700">
            <div className="flex flex-col">
              <span>Вы играете:</span>
              <span className="text-sm font-semibold">
                {player?.side === "white" ? "Белыми" : "Чёрными"}
              </span>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px]">
              {statusText}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-2 text-sm font-mono text-white">
              <span>Чёрные</span>
              <span className="text-lg">
                {formatMs(blackTime)}
              </span>
            </div>

            <div className="aspect-square max-h-[480px] w-full max-w-[480px] mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              <Chessboard
                position={gameRow.fen && gameRow.fen !== "startpos" ? gameRow.fen : game.fen()}
                onPieceDrop={onDrop}
                boardOrientation={boardOrientation}
                customDarkSquareStyle={{ backgroundColor: "#b58863" }}
                customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
                customBoardStyle={{
                  borderRadius: "1.5rem",
                  boxShadow: "0 15px 40px rgba(15,23,42,0.15)"
                }}
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-2 text-sm font-mono text-white">
              <span>Белые</span>
              <span className="text-lg">
                {formatMs(whiteTime)}
              </span>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-600">
              {error}
            </p>
          )}
        </section>

        <aside className="w-full max-w-md space-y-4 md:w-80">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-md">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Как играть
            </h2>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-700">
              <li>Создатель партии копирует ссылку и отправляет другу.</li>
              <li>Второй игрок открывает ссылку на своём устройстве.</li>
              <li>Когда оба подключены, партия автоматически стартует.</li>
              <li>Следите за временем: у каждого есть свой лимит.</li>
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}

