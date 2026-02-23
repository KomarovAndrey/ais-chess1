"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ChevronLeft, ChevronRight, SkipBack, SkipForward, Download } from "lucide-react";
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
  draw_offer_from?: string | null;
  moves?: string[];
}

interface PlayerRow {
  id: string;
  side: "white" | "black";
  player_id: string;
  joined_at: string;
}

interface PlayerInfo {
  username: string | null;
  rating: number | null;
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

/** Число полуходов по FEN (для сравнения «кто впереди»). -1 если FEN невалидный. */
function pliesFromFen(fen: string | null | undefined): number {
  if (!fen || fen === "startpos") return 0;
  try {
    const c = new Chess(fen);
    return c.history().length;
  } catch {
    return -1;
  }
}

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** FEN after applying first n moves from start position. */
function fenAtStep(moves: string[], step: number): string {
  if (!moves.length || step <= 0) return START_FEN;
  const chess = new Chess();
  const end = Math.min(step, moves.length);
  for (let i = 0; i < end; i++) {
    const m = chess.move(moves[i], { strict: false });
    if (!m) break;
  }
  return chess.fen();
}

/** Build PGN string for download. */
function buildPgn(
  moves: string[],
  whiteName: string,
  blackName: string,
  result: "white" | "black" | "draw" | null,
  timeControlSeconds: number
): string {
  const chess = new Chess();
  const moveList: string[] = [];
  let moveNumber = 1;
  for (const uci of moves) {
    const m = chess.move(uci, { strict: false });
    if (!m) break;
    if (m.color === "w") {
      moveList.push(`${moveNumber}. ${m.san}`);
    } else {
      moveList.push(m.san);
      moveNumber++;
    }
  }
  const resultTag =
    result === "white" ? "1-0" : result === "black" ? "0-1" : "1/2-1/2";
  const headers = [
    `[Event "AIS Chess"]`,
    `[Site "?"]`,
    `[Date "${new Date().toISOString().slice(0, 10).replace(/-/g, ".")}"]`,
    `[White "${whiteName.replace(/"/g, '\\"')}"]`,
    `[Black "${blackName.replace(/"/g, '\\"')}"]`,
    `[TimeControl "${timeControlSeconds}"]`,
    `[Result "${resultTag}"]`,
    ""
  ].join("\n");
  return headers + moveList.join(" ") + " " + resultTag;
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

  const [whitePlayerInfo, setWhitePlayerInfo] = useState<PlayerInfo>({ username: null, rating: null });
  const [blackPlayerInfo, setBlackPlayerInfo] = useState<PlayerInfo>({ username: null, rating: null });
  /** Replay: 0 = start, moves.length = final position. Only used when status === 'finished'. */
  const [replayStep, setReplayStep] = useState(0);

  // Игнорировать устаревшие Realtime/poll, чтобы ход не откатывался
  const lastMoveAtRef = useRef<string | null>(initialGame.last_move_at ?? null);

  const isMyTurn = useMemo(() => {
    if (!player) return false;
    const active = gameRow.active_color;
    return (active === "w" && player.side === "white") || (active === "b" && player.side === "black");
  }, [player, gameRow.active_color]);

  // Initialize player id: auth user for logged-in, else localStorage guest id
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user?.id) {
        setPlayerId(session.user.id);
      } else {
        let id = window.localStorage.getItem("ais_chess_player_id");
        if (!id) {
          id = crypto.randomUUID();
          window.localStorage.setItem("ais_chess_player_id", id);
        }
        setPlayerId(id);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (cancelled) return;
      if (session?.user?.id) setPlayerId(session.user.id);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
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
          lastMoveAtRef.current = data.game.last_move_at ?? null;
          setGameRow(data.game);
          setPlayer(data.player);
          setWhiteTime(data.game.white_time_left);
          setBlackTime(data.game.black_time_left);
          if (data.whitePlayer) setWhitePlayerInfo(data.whitePlayer);
          if (data.blackPlayer) setBlackPlayerInfo(data.blackPlayer);
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

  // Подтянуть логины и рейтинги соперника, когда партия началась или завершилась
  useEffect(() => {
    if (!gameId || (gameRow.status !== "active" && gameRow.status !== "finished")) return;
    let cancelled = false;
    fetch(`/api/games/${gameId}/players`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          if (data.whitePlayer) setWhitePlayerInfo(data.whitePlayer);
          if (data.blackPlayer) setBlackPlayerInfo(data.blackPlayer);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [gameId, gameRow.status]);

  // Subscribe to realtime updates (Supabase Realtime). Игнорируем устаревшие события.
  useEffect(() => {
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          const newGame = payload.new as GameRow;
          const incomingAt = newGame.last_move_at ? new Date(newGame.last_move_at).getTime() : 0;
          const seenAt = lastMoveAtRef.current ? new Date(lastMoveAtRef.current).getTime() : 0;
          const incomingPlies = pliesFromFen(newGame.fen);
          const currentPlies = game.history().length;
          const isAheadByPlies = incomingPlies >= 0 && incomingPlies > currentPlies;
          const isStaleByTime = incomingAt > 0 && seenAt > 0 && incomingAt <= seenAt;
          if (isStaleByTime && !isAheadByPlies) return;
          lastMoveAtRef.current = newGame.last_move_at;
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

  // Polling fallback: только когда ждём соперника. Не применять устаревшее состояние.
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
      const incomingAt = newGame.last_move_at ? new Date(newGame.last_move_at).getTime() : 0;
      const seenAt = lastMoveAtRef.current ? new Date(lastMoveAtRef.current).getTime() : 0;
      const incomingPlies = pliesFromFen(newGame.fen);
      const currentPlies = game.history().length;
      const isAheadByPlies = incomingPlies >= 0 && incomingPlies > currentPlies;
      const isStaleByTime = incomingAt > 0 && seenAt > 0 && incomingAt <= seenAt;
      if (isStaleByTime && !isAheadByPlies) return;
      lastMoveAtRef.current = newGame.last_move_at;
      setGameRow(newGame);
      setWhiteTime(newGame.white_time_left);
      setBlackTime(newGame.black_time_left);
      if (newGame.fen) {
        game.load(newGame.fen);
      }
    };

    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [player, gameId, gameRow.status, isMyTurn, game]);

  // Local ticking of clocks: чья очередь хода — те часы и идут
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
  const topSide: "white" | "black" = boardOrientation === "white" ? "black" : "white";
  const bottomSide: "white" | "black" = boardOrientation;

  const topInfo = topSide === "white" ? whitePlayerInfo : blackPlayerInfo;
  const bottomInfo = bottomSide === "white" ? whitePlayerInfo : blackPlayerInfo;
  const topTime = topSide === "white" ? whiteTime : blackTime;
  const bottomTime = bottomSide === "white" ? whiteTime : blackTime;

  const canMove =
    player &&
    gameRow.status === "active" &&
    isMyTurn &&
    whiteTime > 0 &&
    blackTime > 0;

  const mySide = player?.side ?? null;
  const drawOfferedByMe =
    !!gameRow.draw_offer_from && !!playerId && gameRow.draw_offer_from === playerId;
  const drawOfferedToMe =
    !!gameRow.draw_offer_from && !!playerId && gameRow.draw_offer_from !== playerId;

  /** Send move (UCI) or legacy payload (e.g. time's up). Returns server game state on 200; throws on error. */
  async function sendUpdate(
    opts:
      | { uci: string }
      | {
          fen: string;
          activeColor: "w" | "b";
          whiteTimeLeft: number;
          blackTimeLeft: number;
          status: GameStatus;
          winner?: "white" | "black" | "draw" | null;
        }
  ): Promise<{ game: GameRow }> {
    const body = playerId ? { ...opts, playerId } : opts;
    const res = await fetch(`/api/games/${gameId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || "Ход не принят");
    }
    return data as { game: GameRow };
  }

  const onDrop = (sourceSquare: string, targetSquare: string): boolean => {
    if (!canMove) return false;

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
      const loser = currentWhite <= 0 ? "white" : "black";
      const winner = loser === "white" ? "black" : "white";
      sendUpdate({
        fen: gameRow.fen,
        activeColor: gameRow.active_color,
        whiteTimeLeft: Math.max(currentWhite, 0),
        blackTimeLeft: Math.max(currentBlack, 0),
        status: "finished",
        winner
      })
        .then((data) => {
          setGameRow(data.game);
          setWhiteTime(data.game.white_time_left);
          setBlackTime(data.game.black_time_left);
          lastMoveAtRef.current = data.game.last_move_at;
          if (data.game.fen && data.game.fen !== "startpos") game.load(data.game.fen);
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : "Ход не принят");
        });
      return false;
    }

    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q"
    });

    if (move === null) return false;

    const prevGameRow = gameRow;
    const prevWhite = whiteTime;
    const prevBlack = blackTime;

    setGameRow((prev) => ({
      ...prev,
      fen: game.fen(),
      active_color: game.turn() as "w" | "b",
      white_time_left: currentWhite,
      black_time_left: currentBlack,
      status: game.isGameOver() ? "finished" : "active"
    }));
    setWhiteTime(currentWhite);
    setBlackTime(currentBlack);

    sendUpdate({ uci: move.lan })
      .then((data) => {
        lastMoveAtRef.current = data.game.last_move_at;
        setGameRow(data.game);
        setWhiteTime(data.game.white_time_left);
        setBlackTime(data.game.black_time_left);
        if (data.game.fen) game.load(data.game.fen);
        setError(null);
      })
      .catch((e: unknown) => {
        game.undo();
        setGameRow(prevGameRow);
        setWhiteTime(prevWhite);
        setBlackTime(prevBlack);
        setError(e instanceof Error ? e.message : "Ход не принят");
      });
    return true;
  };

  async function sendDrawAction(action: "offer" | "decline") {
    if (!playerId) return;
    try {
      const res = await fetch(`/api/games/${gameId}/draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, playerId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Ошибка обработки ничьей");
      }
      if ((data as any).game) {
        const g = (data as any).game as GameRow;
        setGameRow((prev) => ({ ...prev, draw_offer_from: g.draw_offer_from }));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка обработки ничьей");
    }
  }

  async function handleAcceptDraw() {
    try {
      const { game: updated } = await sendUpdate({
        fen: gameRow.fen,
        activeColor: gameRow.active_color,
        whiteTimeLeft: whiteTime,
        blackTimeLeft: blackTime,
        status: "finished",
        winner: "draw"
      });
      lastMoveAtRef.current = updated.last_move_at;
      setGameRow(updated);
      setWhiteTime(updated.white_time_left);
      setBlackTime(updated.black_time_left);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Не удалось завершить партию");
    } finally {
      // Очистить предложение ничьей на всякий случай
      sendDrawAction("decline").catch(() => {});
    }
  }

  async function handleResign() {
    if (!player || gameRow.status !== "active") return;
    const loserSide = player.side;
    const winnerSide = loserSide === "white" ? "black" : "white";
    try {
      const { game: updated } = await sendUpdate({
        fen: gameRow.fen,
        activeColor: gameRow.active_color,
        whiteTimeLeft: whiteTime,
        blackTimeLeft: blackTime,
        status: "finished",
        winner: winnerSide
      });
      lastMoveAtRef.current = updated.last_move_at;
      setGameRow(updated);
      setWhiteTime(updated.white_time_left);
      setBlackTime(updated.black_time_left);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Не удалось сдаться");
    }
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

  const moveList = gameRow.moves ?? [];
  const replayFen =
    gameRow.status === "finished" && moveList.length > 0
      ? fenAtStep(moveList, replayStep)
      : null;
  const displayFen =
    replayFen ?? (gameRow.fen && gameRow.fen !== "startpos" ? gameRow.fen : game.fen());

  const syncReplayStepToMoves = () => {
    const len = moveList.length;
    if (replayStep > len) setReplayStep(len);
  };
  useEffect(syncReplayStepToMoves, [moveList.length, replayStep]);

  // When game becomes finished, show final position by default
  useEffect(() => {
    if (gameRow.status === "finished" && moveList.length > 0 && replayStep === 0) {
      setReplayStep(moveList.length);
    }
  }, [gameRow.status, moveList.length, replayStep]);

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
              <span>
                {topSide === "white" ? "Белые" : "Чёрные"}
                {topInfo.username != null ? (
                  <> · {topInfo.username} ({topInfo.rating ?? 1500})</>
                ) : (
                  <> · Гость</>
                )}
              </span>
              <span className="text-lg">
                {formatMs(topTime)}
              </span>
            </div>

            <div
              role="img"
              aria-label="Шахматная доска. Текущая позиция."
              className="mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
              style={{
                width: "min(100vw - 2rem, 70vh, 480px)",
                height: "min(100vw - 2rem, 70vh, 480px)",
                touchAction: "manipulation"
              }}
            >
              <Chessboard
                position={displayFen}
                onPieceDrop={gameRow.status === "active" ? onDrop : undefined}
                boardOrientation={boardOrientation}
                customDarkSquareStyle={{ backgroundColor: "#b58863" }}
                customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
                customBoardStyle={{
                  borderRadius: "1.5rem",
                  boxShadow: "0 15px 40px rgba(15,23,42,0.15)"
                }}
              />
            </div>
            {moveList.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <p
                  className="text-sm text-slate-600"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {replayStep > 0
                    ? `Ход ${replayStep}: ${moveList[replayStep - 1]?.replace(/([a-h])([1-8])/g, "$1-$2") ?? ""}`
                    : "Начальная позиция"}
                </p>
              </div>
            )}

            {gameRow.status === "active" && (
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={!player || drawOfferedByMe}
                  onClick={() => {
                    void sendDrawAction("offer");
                  }}
                  title="Предложить ничью"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="text-lg">🤝</span>
                </button>
                <button
                  type="button"
                  disabled={!player}
                  onClick={() => {
                    void handleResign();
                  }}
                  title="Сдаться"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="text-lg">🏳️</span>
                </button>
              </div>
            )}

            <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-2 text-sm font-mono text-white">
              <span>
                {bottomSide === "white" ? "Белые" : "Чёрные"}
                {bottomInfo.username != null ? (
                  <> · {bottomInfo.username} ({bottomInfo.rating ?? 1500})</>
                ) : (
                  <> · Гость</>
                )}
              </span>
              <span className="text-lg">
                {formatMs(bottomTime)}
              </span>
            </div>
            </div>

          {gameRow.status === "finished" && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Итог партии</h3>
              <p className="text-slate-700">
                {gameRow.winner === "draw"
                  ? "Ничья."
                  : gameRow.winner === "white"
                    ? "Победили белые."
                    : "Победили чёрные."}
              </p>
              {gameRow.started_at && (
                <p className="mt-1 text-xs text-slate-500">
                  Партия заняла {moveList.length} ходов.
                </p>
              )}
              <div className="mt-3">
                <Link
                  href="/"
                  className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Сыграть ещё
                </Link>
              </div>
            </div>
          )}

          {gameRow.status === "finished" && moveList.length > 0 && (
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
                  {replayStep} / {moveList.length}
                </span>
                <button
                  type="button"
                  onClick={() => setReplayStep((s) => Math.min(moveList.length, s + 1))}
                  disabled={replayStep === moveList.length}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  aria-label="Вперёд"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setReplayStep(moveList.length)}
                  disabled={replayStep === moveList.length}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  aria-label="В конец"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const whiteName = whitePlayerInfo.username ?? "Белые";
                    const blackName = blackPlayerInfo.username ?? "Чёрные";
                    const pgn = buildPgn(
                      moveList,
                      whiteName,
                      blackName,
                      gameRow.winner,
                      gameRow.time_control_seconds
                    );
                    const blob = new Blob([pgn], { type: "application/x-chess-pgn" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `ais-chess-${gameId}.pgn`;
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

          {error && (
            <p className="mt-3 text-xs text-red-600">
              {error}
            </p>
          )}
        </section>

        {drawOfferedToMe && gameRow.status === "active" && (
          <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-4 pb-[env(safe-area-inset-bottom)] md:bottom-20">
            <div className="max-w-xs rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-lg">
              <p className="mb-2 text-slate-800">Соперник предлагает ничью.</p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await sendDrawAction("decline");
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100"
                  aria-label="Отклонить ничью"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={handleAcceptDraw}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                  aria-label="Принять ничью"
                >
                  ✓
                </button>
              </div>
            </div>
          </div>
        )}

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

