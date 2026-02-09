"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, Cpu, X } from "lucide-react";

const TIME_OPTIONS = [
  { seconds: 180, label: "3 мин" },
  { seconds: 300, label: "5 мин" },
  { seconds: 600, label: "10 мин" },
  { seconds: 900, label: "15 мин" },
];

const SIDE_OPTIONS: { id: "black" | "random" | "white"; label: string; icon: string }[] = [
  { id: "black", label: "Чёрные", icon: "♚" },
  { id: "random", label: "Случайный цвет", icon: "♔♚" },
  { id: "white", label: "Белые", icon: "♔" },
];

export default function HomePage() {
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [colorChoice, setColorChoice] = useState<"white" | "black" | "random">("random");
  const [timeControl, setTimeControl] = useState<number>(300);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Close modal on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setShowModal(false);
  }, []);

  useEffect(() => {
    if (showModal) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [showModal, handleKeyDown]);

  async function handleCreateGame() {
    setError(null);
    setIsCreating(true);
    const existingId = window.localStorage.getItem("ais_chess_player_id");
    const playerId = existingId || crypto.randomUUID();
    if (!existingId) window.localStorage.setItem("ais_chess_player_id", playerId);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorColor: colorChoice,
          timeControlSeconds: timeControl,
          playerId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Не удалось создать партию");
      }
      const data = await res.json();
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}/play/${data.gameId}`
          : "";
      await navigator.clipboard.writeText(url);
      router.push(`/play/${data.gameId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Произошла ошибка");
    } finally {
      setIsCreating(false);
    }
  }

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
          </div>

          {/* Action panel */}
          <div className="mt-6 flex min-w-0 max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-md md:p-8">
            <h2 className="mb-6 w-full text-center text-lg font-semibold text-slate-900">
              Онлайн-партия
            </h2>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3.5 text-left text-sm font-medium text-slate-100 shadow-sm transition hover:bg-slate-600"
                onClick={() => {
                  setError(null);
                  setShowModal(true);
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
          </div>
        </section>
      </div>

      {/* Modal — Параметры игры (Lichess-style) */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl bg-[#2b2b2b] text-white shadow-2xl">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Title */}
            <div className="px-6 pt-6 pb-2">
              <h3 className="text-center text-xl font-semibold tracking-wide">
                Параметры игры
              </h3>
            </div>

            <div className="px-6 pb-6 pt-2 space-y-6">
              {/* Time selection */}
              <div>
                <p className="mb-3 text-center text-sm font-medium text-gray-300">
                  Минут на партию
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.seconds}
                      type="button"
                      onClick={() => setTimeControl(opt.seconds)}
                      className={`rounded-xl px-3 py-3 text-sm font-bold transition ${
                        timeControl === opt.seconds
                          ? "bg-green-600 text-white shadow-lg"
                          : "bg-[#3a3a3a] text-gray-300 hover:bg-[#4a4a4a]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Side selection */}
              <div>
                <p className="mb-3 text-center text-sm font-medium text-gray-300">
                  Сторона
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SIDE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setColorChoice(opt.id)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl px-3 py-4 text-sm font-medium transition ${
                        colorChoice === opt.id
                          ? "bg-green-600 text-white shadow-lg"
                          : "bg-[#3a3a3a] text-gray-300 hover:bg-[#4a4a4a]"
                      }`}
                    >
                      <span className="text-2xl leading-none">{opt.icon}</span>
                      <span className="text-xs">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Create game button */}
              <button
                type="button"
                disabled={isCreating}
                onClick={handleCreateGame}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-green-600 px-4 py-4 text-base font-semibold text-white shadow-md transition hover:bg-green-500 disabled:opacity-60"
              >
                <UserPlus className="h-5 w-5 shrink-0" />
                {isCreating ? "Создаётся…" : "Бросить вызов другу"}
              </button>

              {error && (
                <p className="text-center text-sm text-red-400">{error}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
