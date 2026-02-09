"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Users, UserPlus, Cpu, Clock } from "lucide-react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

// Партии Магнуса Карлсена (PGN), по очереди прокручиваются на главной
const CARLSEN_GAMES_PGN = [
  // Carlsen – Aronian, Norway Chess 2013
  `[Event "Norway Chess"][White "Carlsen, Magnus"][Black "Aronian, Levon"][Result "1-0"]
1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 O-O 5. Bd3 d5 6. Nf3 c5 7. O-O Nc6 8. a3 Bxc3 9. bxc3 dxc4 10. Bxc4 b6 11. Bd3 Ba6 12. Bxa6 Nxa6 13. Ba3 Rc8 14. Qe2 Nb8 15. c4 cxd4 16. exd4 Nc6 17. Rfd1 Qe8 18. d5 exd5 19. cxd5 Ne5 20. Nxe5 Qxe5 21. Rac1 Rxc1 22. Rxc1 Rd8 23. h3 b5 24. Bb4 Qd6 25. Qe3 a5 26. Bc5 Qe5 27. f4 Qc7 28. d6 Qd7 29. Bb6 Rd7 30. Rc8 g6 31. Qe8+ Kg7 32. d7 1-0`,
  // Carlsen – Anand, Bilbao 2010
  `[Event "Bilbao"][White "Carlsen, Magnus"][Black "Anand, Viswanathan"][Result "1-0"]
1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. d3 Bc5 5. c3 O-O 6. O-O d6 7. Nbd2 a6 8. Bc4 Ba7 9. Re1 Ne7 10. Nf1 Ng6 11. Ng3 c6 12. h4 Nf4 13. Bxf4 exf4 14. Nd2 d5 15. exd5 cxd5 16. Bb3 Be6 17. Nc4 Bxc4 18. Bxc4 dxc4 19. d4 Bb6 20. Ne4 Nd5 21. Ng5 Nf6 22. Qh5 h6 23. Nxf7 Rxf7 24. Qxf7+ Kh8 25. Qe8+ 1-0`,
  // Carlsen – Svidler, London 2012 (фрагмент)
  `[Event "London"][White "Carlsen, Magnus"][Black "Svidler, Peter"][Result "1-0"]
1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6 8. d5 Ne7 9. Nd2 a5 10. Rb1 Nd7 11. b3 f5 12. exf5 gxf5 13. f4 Ne8 14. Nf3 Nf6 15. Bd2 exf4 16. Bxf4 Ng6 17. Be3 f4 18. Bf2 Ng4 19. Bd4 Rf7 20. Qc2 Nf8 21. Rae1 Bd7 22. Re6 Bxe6 23. dxe6 Rf6 24. exd7 Qxd7 25. Bxg7 Kxg7 26. Ne5 Nxe5 27. Bxa8 Nc6 28. Bf3 Ne5 29. Qe4 Nxf3+ 30. Qxf3 Rf8 31. Qe4 1-0`,
];

// Запасная партия, если PGN не разберутся
const FALLBACK_GAME = [
  "e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5",
];

function parseCarlsenGames(): string[][] {
  const result: string[][] = [];
  for (const pgn of CARLSEN_GAMES_PGN) {
    try {
      const g = new Chess();
      g.loadPgn(pgn);
      const history = g.history();
      if (history.length > 0) result.push(history);
    } catch {
      // skip invalid PGN
    }
  }
  if (result.length === 0) result.push(FALLBACK_GAME);
  return result;
}

export default function HomePage() {
  const [gamesMoves, setGamesMoves] = useState<string[][]>(() => [FALLBACK_GAME]);

  useEffect(() => {
    try {
      const parsed = parseCarlsenGames();
      if (parsed.length > 0) setGamesMoves(parsed);
    } catch {
      // уже есть FALLBACK_GAME в state
    }
  }, []);
  const [game] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());
  const [gameIndex, setGameIndex] = useState(0);
  const [moveIndex, setMoveIndex] = useState(0);
  const [status, setStatus] = useState("Партии Магнуса Карлсена");
  const [isCreating, setIsCreating] = useState(false);
  const [colorChoice, setColorChoice] = useState<"white" | "black" | "random">("random");
  const [timeControl, setTimeControl] = useState<number>(300);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (gamesMoves.length === 0) return;

    const currentMoves = gamesMoves[gameIndex];
    if (moveIndex >= currentMoves.length) {
      setStatus("Партия закончилась. Следующая партия Карлсена...");
      const timer = setTimeout(() => {
        game.reset();
        setFen(game.fen());
        setMoveIndex(0);
        setGameIndex((i) => (i + 1) % gamesMoves.length);
        setStatus("Партии Магнуса Карлсена");
      }, 1500);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      const san = currentMoves[moveIndex];
      const move = game.move(san);
      setFen(game.fen());
      setMoveIndex((j) => j + 1);
    }, 700);

    return () => clearTimeout(timer);
  }, [game, fen, gameIndex, moveIndex, gamesMoves]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-orange-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 md:py-16">
        <section className="grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div className="space-y-6">
            <p className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-blue-700">
              Шахматы внутри школы
            </p>
            <h1 className="text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl md:text-5xl">
              Тренируйся, играй и{" "}
              <span className="text-orange-500">становись сильнее</span> в AIS
              Chess.
            </h1>
            <p className="max-w-xl text-base text-slate-600 md:text-lg">
              Простой и удобный сайт для школьных турниров, тренировок и
              дружеских партий. Ничего лишнего — только шахматная доска,
              соперник и твой план.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                className="btn-primary text-lg inline-flex items-center justify-center rounded-full px-6 py-3 font-semibold shadow-md hover:shadow-lg transition disabled:opacity-60"
                disabled={isCreating}
                onClick={() => {
                  const el = document.getElementById("new-game-panel");
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                Начать онлайн-партию
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
              <div className="text-xs text-slate-500 sm:text-sm">
                Или{" "}
                <Link
                  href="/login"
                  className="font-semibold text-blue-700 underline-offset-4 hover:underline"
                >
                  войди в аккаунт
                </Link>{" "}
                и продолжи с сохранёнными партиями (в будущем).
              </div>
            </div>

          </div>

          <div
            id="new-game-panel"
            className="mt-6 flex min-w-0 max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-md md:p-8"
          >
            <h2 className="mb-2 w-full text-center text-lg font-semibold text-slate-900">
              Онлайн-партия
            </h2>
            <p className="mb-6 text-center text-sm text-slate-500">
              Стандартные правила. Регистрация не нужна — можно играть по ссылке.
            </p>

            <p className="mb-2 text-sm font-medium text-slate-700">
              Время на партию (каждому игроку)
            </p>
            <div className="mb-6 grid grid-cols-3 gap-3">
              {[
                { seconds: 180, label: "3 минуты" },
                { seconds: 300, label: "5 минут" },
                { seconds: 600, label: "10 минут" }
              ].map((opt) => (
                <button
                  key={opt.seconds}
                  type="button"
                  onClick={() => setTimeControl(opt.seconds)}
                  className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                    timeControl === opt.seconds
                      ? "border-slate-500 bg-slate-700 text-white shadow-inner"
                      : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <Clock className="h-4 w-4 shrink-0" />
                  {opt.label}
                </button>
              ))}
            </div>

            <p className="mb-2 text-sm font-medium text-slate-700">Цвет фигур</p>
            <div className="mb-6 flex gap-3">
              {[
                { id: "white", label: "Белые" },
                { id: "black", label: "Чёрные" },
                { id: "random", label: "Случайно" }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    setColorChoice(opt.id as "white" | "black" | "random")
                  }
                  className={`flex flex-1 min-h-[44px] items-center justify-center rounded-xl border text-sm font-medium transition ${
                    colorChoice === opt.id
                      ? "border-slate-500 bg-slate-700 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={isCreating}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3.5 text-left text-sm font-medium text-slate-100 shadow-sm transition hover:bg-slate-600 disabled:opacity-60"
                onClick={async () => {
                  setError(null);
                  setIsCreating(true);
                  const existingId = window.localStorage.getItem("ais_chess_player_id");
                  let playerId = existingId || crypto.randomUUID();
                  if (!existingId) window.localStorage.setItem("ais_chess_player_id", playerId);
                  try {
                    const res = await fetch("/api/games", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        creatorColor: colorChoice,
                        timeControlSeconds: timeControl,
                        playerId
                      })
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(data.error || "Не удалось создать партию");
                    }
                    const data = await res.json();
                    router.push(data.url);
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Произошла ошибка");
                  } finally {
                    setIsCreating(false);
                  }
                }}
              >
                <Users className="h-5 w-5 shrink-0 text-slate-300" />
                Создать запрос на игру
              </button>

              <button
                type="button"
                disabled={isCreating}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3.5 text-left text-sm font-medium text-slate-100 shadow-sm transition hover:bg-slate-600 disabled:opacity-60"
                onClick={async () => {
                  setError(null);
                  setIsCreating(true);
                  const existingId = window.localStorage.getItem("ais_chess_player_id");
                  let playerId = existingId || crypto.randomUUID();
                  if (!existingId) window.localStorage.setItem("ais_chess_player_id", playerId);
                  try {
                    const res = await fetch("/api/games", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        creatorColor: colorChoice,
                        timeControlSeconds: timeControl,
                        playerId
                      })
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(data.error || "Не удалось создать партию");
                    }
                    const data = await res.json();
                    const url = typeof window !== "undefined" ? `${window.location.origin}/play/${data.gameId}` : "";
                    await navigator.clipboard.writeText(url);
                    router.push(`/play/${data.gameId}`);
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Произошла ошибка");
                  } finally {
                    setIsCreating(false);
                  }
                }}
              >
                <UserPlus className="h-5 w-5 shrink-0 text-slate-300" />
                Бросить вызов другу
              </button>

              <Link
                href="/chess"
                className="flex w-full items-center gap-3 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3.5 text-left text-sm font-medium text-slate-100 shadow-sm transition hover:bg-slate-600"
              >
                <Cpu className="h-5 w-5 shrink-0 text-slate-300" />
                Сыграть с компьютером
              </Link>
            </div>

            {error && (
              <p className="mt-4 w-full text-center text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="card flex flex-col items-center gap-4 rounded-3xl bg-white/90 p-6 shadow-lg">
            <div className="aspect-square max-h-[420px] w-full max-w-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              <Chessboard
                position={fen}
                arePiecesDraggable={false}
                customDarkSquareStyle={{ backgroundColor: "#b58863" }}
                customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
                customBoardStyle={{
                  borderRadius: "1.5rem",
                  boxShadow: "0 15px 40px rgba(15,23,42,0.15)",
                }}
              />
            </div>
            <p className="text-center text-sm font-medium text-slate-700">
              {status}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

