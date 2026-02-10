"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Cpu, X } from "lucide-react";
import GameParamsModal from "@/components/GameParamsModal";
import { supabase } from "@/lib/supabaseClient";

const TIME_OPTIONS = [
  { seconds: 60, label: "1 мин" },
  { seconds: 120, label: "2 мин" },
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

const CPU_LEVELS = [1, 2, 3, 4, 5] as const;

export default function HomePage() {
  const [showModal, setShowModal] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [showCpuModal, setShowCpuModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSendingChallenge, setIsSendingChallenge] = useState(false);
  const [colorChoice, setColorChoice] = useState<"white" | "black" | "random">("random");
  const [timeControl, setTimeControl] = useState<number>(300);
  const [cpuColorChoice, setCpuColorChoice] = useState<"white" | "black" | "random">("random");
  const [cpuLevel, setCpuLevel] = useState<number>(3);
  const [error, setError] = useState<string | null>(null);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [challengeOk, setChallengeOk] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<{ id: string; username: string | null; display_name: string; rating: number }[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string>("");
  const router = useRouter();

  const modalOpen = showModal || showFriendModal || showCpuModal;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("open") === "cpu") setShowCpuModal(true);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowModal(false);
      setShowCpuModal(false);
    }
  }, []);

  useEffect(() => {
    if (modalOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [modalOpen, handleKeyDown]);

  async function handleCreateGame(opts?: { creatorColor: "white" | "black" | "random"; timeControlSeconds: number }) {
    setError(null);
    setIsCreating(true);
    const existingId = window.localStorage.getItem("ais_chess_player_id");
    const playerId = existingId || crypto.randomUUID();
    if (!existingId) window.localStorage.setItem("ais_chess_player_id", playerId);
    const creatorColor = opts?.creatorColor ?? colorChoice;
    const timeControlSeconds = opts?.timeControlSeconds ?? timeControl;
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorColor,
          timeControlSeconds,
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

  async function loadFriends() {
    if (!userId) return;
    setFriendsLoading(true);
    try {
      const res = await fetch("/api/friends");
      if (!res.ok) throw new Error("Не удалось загрузить друзей");
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data?.friends) ? data.friends : [];
      setFriends(list);
      if (!selectedFriendId && list.length > 0) setSelectedFriendId(list[0].id);
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : "Ошибка загрузки друзей");
    } finally {
      setFriendsLoading(false);
    }
  }

  useEffect(() => {
    if (showFriendModal) {
      setChallengeError(null);
      setChallengeOk(null);
      loadFriends();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFriendModal]);

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
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3.5 text-center text-sm font-medium text-slate-100 shadow-sm transition hover:bg-slate-600"
                onClick={() => {
                  if (userId) {
                    setChallengeError(null);
                    setChallengeOk(null);
                    setShowFriendModal(true);
                  } else {
                    setError(null);
                    setShowModal(true);
                  }
                }}
              >
                <UserPlus className="h-5 w-5 shrink-0 text-slate-300" />
                Бросить вызов другу
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3.5 text-center text-sm font-medium text-slate-100 shadow-sm transition hover:bg-slate-600"
                onClick={() => {
                  setError(null);
                  setShowCpuModal(true);
                }}
              >
                <Cpu className="h-5 w-5 shrink-0 text-slate-300" />
                Сыграть с компьютером
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Modal — Бросить вызов другу (создание игры по ссылке) */}
      <GameParamsModal
        open={showModal}
        title="Параметры игры"
        submitLabel="Бросить вызов другу"
        submittingLabel="Создаётся…"
        initialCreatorColor={colorChoice}
        initialTimeControlSeconds={timeControl}
        isSubmitting={isCreating}
        errorText={error}
        onClose={() => setShowModal(false)}
        onSubmit={async ({ creatorColor, timeControlSeconds }) => {
          setColorChoice(creatorColor);
          setTimeControl(timeControlSeconds);
          await handleCreateGame({ creatorColor, timeControlSeconds });
        }}
      />

      {/* Modal — Бросить вызов другу (через уведомления, для зарегистрированных) */}
      <GameParamsModal
        open={showFriendModal}
        title="Параметры игры"
        submitLabel="Отправить вызов"
        submittingLabel="Отправка…"
        initialCreatorColor={colorChoice}
        initialTimeControlSeconds={timeControl}
        isSubmitting={isSendingChallenge}
        submitDisabled={friendsLoading || isSendingChallenge}
        errorText={challengeError}
        onClose={() => setShowFriendModal(false)}
        topContent={
          <div className="space-y-2">
            <p className="text-center text-sm font-medium text-slate-600">Кого вызвать</p>
            {friendsLoading ? (
              <p className="text-center text-sm text-slate-500">Загрузка друзей…</p>
            ) : friends.length === 0 ? (
              <p className="text-center text-sm text-slate-500">У вас пока нет добавленных друзей.</p>
            ) : (
              <select
                value={selectedFriendId}
                onChange={(e) => setSelectedFriendId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                {friends.map((f) => (
                  <option key={f.id} value={f.id}>
                    {(f.display_name || f.username || "Игрок") + (f.username ? ` (${f.username})` : "") + ` · ${f.rating ?? 1500}`}
                  </option>
                ))}
              </select>
            )}
            {challengeOk && <p className="text-center text-sm text-green-700">{challengeOk}</p>}
          </div>
        }
        onSubmit={async ({ creatorColor, timeControlSeconds }) => {
          setChallengeError(null);
          setChallengeOk(null);

          // Если выбран друг — отправляем ему вызов
          if (selectedFriendId) {
            setIsSendingChallenge(true);
            try {
              const res = await fetch("/api/challenges", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  toUserId: selectedFriendId,
                  creatorColor,
                  timeControlSeconds
                })
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.error ?? "Не удалось отправить вызов");
              setChallengeOk("Вызов отправлен. Ожидайте принятия.");
              setShowFriendModal(false);
            } catch (e) {
              setChallengeError(e instanceof Error ? e.message : "Ошибка");
            } finally {
              setIsSendingChallenge(false);
            }
            return;
          }

          // Если друг не выбран — создаём обычную партию по ссылке
          setColorChoice(creatorColor);
          setTimeControl(timeControlSeconds);
          await handleCreateGame({ creatorColor, timeControlSeconds });
        }}
      />

      {/* Modal — Сыграть с компьютером */}
      {showCpuModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCpuModal(false);
          }}
        >
          <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setShowCpuModal(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="px-6 pt-6 pb-2">
              <h3 className="text-center text-xl font-semibold tracking-wide text-slate-900">
                Игра с компьютером
              </h3>
            </div>
            <div className="px-6 pb-6 pt-2 space-y-6">
              <div>
                <p className="mb-3 text-center text-sm font-medium text-slate-600">
                  Минут на партию
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.seconds}
                      type="button"
                      onClick={() => setTimeControl(opt.seconds)}
                      className={`rounded-xl px-3 py-3 text-sm font-bold transition ${
                        timeControl === opt.seconds
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
                      onClick={() => setCpuColorChoice(opt.id)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-4 text-sm font-medium transition ${
                        cpuColorChoice === opt.id
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
                      onClick={() => setCpuLevel(level)}
                      className={`rounded-xl border px-2 py-3 text-sm font-bold transition ${
                        cpuLevel === level
                          ? "border-2 border-blue-600 bg-blue-600 text-white shadow-md"
                          : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const color = cpuColorChoice === "random"
                    ? (Math.random() < 0.5 ? "white" : "black")
                    : cpuColorChoice;
                  router.push(`/chess?color=${color}&level=${cpuLevel}&time=${timeControl}`);
                }}
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
