"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Users, UserPlus, Cpu, Clock } from "lucide-react";

export default function HomePage() {
  const [isCreating, setIsCreating] = useState(false);
  const [colorChoice, setColorChoice] = useState<"white" | "black" | "random">("random");
  const [timeControl, setTimeControl] = useState<number>(300);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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
        </section>
      </div>
    </main>
  );
}

