"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

export default function HomePage() {
  const [game] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());
  const [status, setStatus] = useState("Идёт рандомная партия");
  const [isCreating, setIsCreating] = useState(false);
  const [colorChoice, setColorChoice] = useState<"white" | "black" | "random">("random");
  const [timeControl, setTimeControl] = useState<number>(600);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (game.isGameOver()) {
      setStatus("Партия закончилась, запускаем новую...");
      const timer = setTimeout(() => {
        game.reset();
        setFen(game.fen());
        setStatus("Идёт рандомная партия");
      }, 1000);
      return () => clearTimeout(timer);
    }

    const moves = game.moves();
    if (moves.length === 0) return;

    const timer = setTimeout(() => {
      const move = moves[Math.floor(Math.random() * moves.length)];
      game.move(move);
      setFen(game.fen());
    }, 700);

    return () => clearTimeout(timer);
  }, [game, fen]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-orange-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 md:py-16">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-20 w-20 overflow-hidden rounded-full bg-slate-900">
              <Image
                src="/ais-emblem-color.png"
                alt="Alabuga International School"
                fill
                style={{ objectFit: "contain" }}
                sizes="80px"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                AIS
              </span>
              <span className="text-lg font-bold text-slate-900">
                Chess
              </span>
            </div>
          </div>

          <nav className="hidden gap-4 text-sm font-medium text-slate-600 md:flex">
            <Link href="/login" className="hover:text-blue-700">
              Войти
            </Link>
            <Link href="/register" className="hover:text-blue-700">
              Регистрация
            </Link>
          </nav>
        </header>

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

            <div className="grid max-w-lg grid-cols-2 gap-3 text-xs text-slate-600 sm:text-sm">
              <div className="card space-y-1">
                <p className="font-semibold text-slate-900">
                  Игра против компьютера
                </p>
                <p>Выбирай уровень сложности и цвет фигур.</p>
              </div>
              <div className="card space-y-1">
                <p className="font-semibold text-slate-900">
                  Для внутришкольных турниров
                </p>
                <p>Минималистичный интерфейс, крупные кнопки, ничего лишнего.</p>
              </div>
            </div>
          </div>

          <div
            id="new-game-panel"
            className="mt-6 flex min-h-[320px] min-w-0 max-w-2xl flex-col items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-md"
          >
            <h2 className="mb-6 w-full text-center text-lg font-semibold text-slate-900">
              Быстрая онлайн-партия по ссылке
            </h2>
            <div className="flex w-full max-w-full flex-col items-center justify-center gap-8 md:flex-row">
              <div className="flex w-full min-w-0 max-w-full flex-col items-center space-y-3 md:max-w-[50%]">
                <p className="w-full text-center text-base font-medium text-slate-700">
                  Цвет фигур
                </p>
                <div className="grid w-full max-w-full grid-cols-3 gap-4 text-base">
                  {[
                    { id: "white", label: "Белый" },
                    { id: "black", label: "Черный" },
                    { id: "random", label: "Случайный" }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setColorChoice(opt.id as "white" | "black" | "random")
                      }
                      className={`flex min-h-[60px] min-w-0 items-center justify-center overflow-visible rounded-2xl border px-5 py-4 font-medium leading-normal transition ${
                        colorChoice === opt.id
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex w-full min-w-0 max-w-full flex-col items-center space-y-3 md:max-w-[50%]">
                <p className="w-full text-center text-base font-medium text-slate-700">
                  Контроль времени (на игрока)
                </p>
                <div className="grid w-full max-w-full grid-cols-3 gap-4 text-base">
                  {[
                    { seconds: 300, label: "5 минут" },
                    { seconds: 600, label: "10 минут" },
                    { seconds: 900, label: "15 минут" }
                  ].map((opt) => (
                    <button
                      key={opt.seconds}
                      type="button"
                      onClick={() => setTimeControl(opt.seconds)}
                      className={`flex min-h-[60px] min-w-0 items-center justify-center overflow-visible rounded-2xl border px-5 py-4 font-medium leading-normal transition ${
                        timeControl === opt.seconds
                          ? "border-orange-500 bg-orange-50 text-orange-700"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <p className="mt-2 w-full text-center text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={isCreating}
              className="mt-6 flex w-full max-w-full items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition disabled:opacity-60"
              onClick={async () => {
                try {
                  setError(null);
                  setIsCreating(true);

                  const existingId = window.localStorage.getItem("ais_chess_player_id");
                  let playerId = existingId;
                  if (!playerId) {
                    playerId = crypto.randomUUID();
                    window.localStorage.setItem("ais_chess_player_id", playerId);
                  }

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
                } catch (e: any) {
                  setError(e.message ?? "Произошла ошибка");
                } finally {
                  setIsCreating(false);
                }
              }}
            >
              {isCreating ? "Создаём партию..." : "Создать ссылку и начать"}
            </button>
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

