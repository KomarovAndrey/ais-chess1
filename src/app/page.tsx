"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, Cpu, X, Trophy, Puzzle, Swords } from "lucide-react";
import GameParamsModal from "@/components/GameParamsModal";
import { CPU_LEVEL_DESCRIPTIONS, CPU_PERSONAS } from "@/lib/cpu-levels";
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
type CpuLevel = (typeof CPU_LEVELS)[number];

export default function HomePage() {
  const [showModal, setShowModal] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [showCpuModal, setShowCpuModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSendingChallenge, setIsSendingChallenge] = useState(false);
  const [colorChoice, setColorChoice] = useState<"white" | "black" | "random">("random");
  const [timeControl, setTimeControl] = useState<number>(300);
  const [cpuColorChoice, setCpuColorChoice] = useState<"white" | "black" | "random">("random");
  const [cpuLevel, setCpuLevel] = useState<CpuLevel>(3);
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
    <main className="page-bg relative min-h-screen overflow-hidden">
      {/* Hero: one composition */}
      <section className="relative min-h-[calc(100dvh-4.5rem)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          aria-hidden
        >
          <div
            className="animate-board-pulse absolute inset-y-0 right-0 w-full max-w-3xl translate-x-[8%] md:w-[58%]"
            style={{
              background:
                "repeating-conic-gradient(#c9a06a 0% 25%, #1a140c 0% 50%) 50% / min(12vw, 72px) min(12vw, 72px)",
              maskImage:
                "linear-gradient(90deg, transparent 0%, black 28%, black 100%)",
              WebkitMaskImage:
                "linear-gradient(90deg, transparent 0%, black 28%, black 100%)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/85 to-ink-900/40" />
        </div>

        <div className="relative mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-6xl flex-col justify-center px-4 py-12 md:py-16">
          <div className="max-w-xl space-y-6">
            <p className="animate-fade-up font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
              AIS Chess
            </p>
            <h1 className="animate-fade-up-delay font-display text-2xl font-semibold leading-tight text-white/95 sm:text-3xl md:text-4xl">
              Играй онлайн. <span className="text-gold">Расти в рейтинге.</span>
            </h1>
            <p className="animate-fade-up-delay-2 max-w-md text-base leading-relaxed text-white/55 md:text-lg">
              Партии с друзьями, рейтинг Bullet / Blitz / Rapid, пазлы и турниры —
              быстрый старт без лишнего шума.
            </p>

            <div className="animate-fade-up-delay-2 flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <button
                type="button"
                className="btn-primary gap-2 transition hover:scale-[1.02] active:scale-[0.98]"
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
                <UserPlus className="h-5 w-5 shrink-0" />
                Бросить вызов
              </button>
              <button
                type="button"
                className="btn-secondary gap-2 transition hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => {
                  setError(null);
                  setShowCpuModal(true);
                }}
              >
                <Cpu className="h-5 w-5 shrink-0 text-gold" />
                С компьютером
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Below fold: secondary destinations */}
      <section className="relative border-t border-white/5">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-10 sm:grid-cols-2 lg:grid-cols-5">
          <Link
            href="/ratings"
            className="group flex min-h-[88px] items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-gold/40 hover:bg-white/[0.07]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Рейтинги</h2>
              <p className="text-xs text-white/40">Топ игроков</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setShowCpuModal(true)}
            className="group flex min-h-[88px] items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-gold/40 hover:bg-white/[0.07]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-semibold text-white">С компьютером</h2>
              <p className="text-xs text-white/40">5 уровней</p>
            </div>
          </button>
          <button
            type="button"
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
            className="group flex min-h-[88px] items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-gold/40 hover:bg-white/[0.07]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <UserPlus className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-semibold text-white">С другом</h2>
              <p className="text-xs text-white/40">Вызов или ссылка</p>
            </div>
          </button>
          <Link
            href="/puzzles"
            className="group flex min-h-[88px] items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-gold/40 hover:bg-white/[0.07]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
              <Puzzle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Головоломки</h2>
              <p className="text-xs text-white/40">Тактика</p>
            </div>
          </Link>
          <Link
            href="/tournaments"
            className="group flex min-h-[88px] items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-gold/40 hover:bg-white/[0.07]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
              <Swords className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Турниры</h2>
              <p className="text-xs text-white/40">Соревнования</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Modal — Бросить вызов (создание игры по ссылке) */}
      <GameParamsModal
        open={showModal}
        title="Параметры игры"
        submitLabel="Бросить вызов"
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

      {/* Modal — Бросить вызов (через уведомления, для зарегистрированных) */}
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
            <p className="text-center text-sm font-medium text-white/50">Кого вызвать</p>
            {friendsLoading ? (
              <p className="text-center text-sm text-white/40">Загрузка друзей…</p>
            ) : friends.length === 0 ? (
              <p className="text-center text-sm text-white/40">У вас пока нет добавленных друзей.</p>
            ) : (
              <select
                value={selectedFriendId}
                onChange={(e) => setSelectedFriendId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
              >
                {friends.map((f) => (
                  <option key={f.id} value={f.id}>
                    {(f.display_name || f.username || "Игрок") + (f.username ? ` (${f.username})` : "") + ` · ${f.rating ?? 1500}`}
                  </option>
                ))}
              </select>
            )}
            {challengeOk && <p className="text-center text-sm text-emerald-400">{challengeOk}</p>}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCpuModal(false);
          }}
        >
          <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-ink-800 shadow-card">
            <button
              type="button"
              onClick={() => setShowCpuModal(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="max-h-[85dvh] overflow-y-auto px-6 pt-6 pb-6 space-y-6">
              <div className="pb-2">
                <h3 className="text-center font-display text-xl font-semibold tracking-wide text-white">
                  Игра с компьютером
                </h3>
              </div>
              <div>
                <p className="mb-3 text-center text-sm font-medium text-white/50">
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
                          ? "border border-gold bg-gold text-ink-900 shadow-glow"
                          : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-center text-sm font-medium text-white/50">
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
                          ? "border-gold bg-gold text-ink-900 shadow-glow"
                          : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-2xl leading-none">{opt.icon}</span>
                      <span className="text-xs">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-center text-sm font-medium text-white/50">
                  Уровень сложности
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {CPU_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setCpuLevel(level)}
                      className={`flex flex-col rounded-xl border px-2 py-3 text-sm font-bold transition ${
                        cpuLevel === level
                          ? "border-gold bg-gold text-ink-900 shadow-glow"
                          : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
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
                <p className="mt-2 text-center text-xs text-white/40">
                  {CPU_LEVEL_DESCRIPTIONS[cpuLevel]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const color = cpuColorChoice === "random"
                    ? (Math.random() < 0.5 ? "white" : "black")
                    : cpuColorChoice;
                  router.push(`/chess?color=${color}&level=${cpuLevel}&time=${timeControl}`);
                }}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gold px-4 py-4 text-base font-semibold text-ink-900 shadow-glow transition hover:bg-gold-bright"
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
