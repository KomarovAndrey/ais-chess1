"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import { Lightbulb, RotateCcw, SkipForward } from "lucide-react";
import BoardShell from "@/components/chess/BoardShell";
import { chessSounds } from "@/lib/chessSounds";
import { themeLabel, type Zadacha } from "@/lib/zadachi-data";

type LoadState = {
  zadacha: Zadacha;
  userRating: number;
  themes: string[];
  source: string;
  daily?: boolean;
  dailyKey?: string;
};

const STREAK_KEY = "ais_zadachi_streak";

function readStreak(): { count: number; lastSolved: string | null } {
  try {
    const raw = window.localStorage.getItem(STREAK_KEY);
    if (!raw) return { count: 0, lastSolved: null };
    const parsed = JSON.parse(raw) as { count?: number; lastSolved?: string };
    return {
      count: typeof parsed.count === "number" ? parsed.count : 0,
      lastSolved: parsed.lastSolved ?? null,
    };
  } catch {
    return { count: 0, lastSolved: null };
  }
}

function bumpStreak(dailyKey: string): number {
  const prev = readStreak();
  if (prev.lastSolved === dailyKey) return prev.count;
  const yesterday = new Date(dailyKey + "T00:00:00Z");
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yKey = yesterday.toISOString().slice(0, 10);
  const next = prev.lastSolved === yKey ? prev.count + 1 : 1;
  window.localStorage.setItem(
    STREAK_KEY,
    JSON.stringify({ count: next, lastSolved: dailyKey })
  );
  return next;
}

export default function ZadachiPage() {
  const [theme, setTheme] = useState<string | null>(null);
  const [daily, setDaily] = useState(false);
  const [data, setData] = useState<LoadState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fen, setFen] = useState("");
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<"play" | "correct" | "wrong" | "done">("play");
  const [sessionOk, setSessionOk] = useState(0);
  const [sessionFail, setSessionFail] = useState(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setStreak(readStreak().count);
  }, []);

  const loadNext = useCallback(
    async (excludeId?: string) => {
      setLoading(true);
      setError(null);
      setStatus("play");
      setStep(0);
      setLastDelta(null);
      try {
        const params = new URLSearchParams();
        if (daily) params.set("daily", "1");
        else if (theme) params.set("theme", theme);
        if (excludeId && !daily) params.set("exclude", excludeId);
        const res = await fetch(`/api/zadachi?${params.toString()}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Не удалось загрузить задачу");
        const z = json.zadacha as Zadacha;
        setData({
          zadacha: z,
          userRating: json.userRating ?? 1500,
          themes: Array.isArray(json.themes) ? json.themes : [],
          source: json.source ?? "seed",
          daily: json.daily,
          dailyKey: json.dailyKey,
        });
        setUserRating(json.userRating ?? 1500);
        setFen(z.fen);
        setBoardKey((k) => k + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка");
      } finally {
        setLoading(false);
      }
    },
    [theme, daily]
  );

  useEffect(() => {
    void loadNext();
  }, [loadNext]);

  const zadacha = data?.zadacha;
  const orientation = useMemo(() => {
    if (!zadacha) return "white" as const;
    return zadacha.fen.split(" ")[1] === "b" ? "black" : "white";
  }, [zadacha]);

  const lastMoveUci = useMemo(() => {
    if (!zadacha || step === 0) return null;
    return zadacha.moves[step - 1] ?? null;
  }, [zadacha, step]);

  async function reportAttempt(success: boolean, puzzleId: string) {
    try {
      const res = await fetch("/api/zadachi/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId, success }),
      });
      if (!res.ok) return;
      const json = await res.json();
      if (typeof json.userRating === "number") setUserRating(json.userRating);
      if (typeof json.userDelta === "number") setLastDelta(json.userDelta);
    } catch {
      /* guest or migration missing */
    }
  }

  const playOpponentIfNeeded = useCallback(
    (currentStep: number, currentFen: string, moves: string[]) => {
      // After player move at even index, opponent replies at odd index
      if (currentStep >= moves.length) return { fen: currentFen, step: currentStep, done: true };
      if (currentStep % 2 === 1) {
        // Opponent to play automatically
        const reply = moves[currentStep];
        if (!reply) return { fen: currentFen, step: currentStep, done: true };
        try {
          const c = new Chess(currentFen);
          const from = reply.slice(0, 2);
          const to = reply.slice(2, 4);
          const promotion = reply.length > 4 ? reply[4] : undefined;
          const m = c.move({
            from,
            to,
            promotion: promotion as "q" | "r" | "b" | "n" | undefined,
          });
          if (!m) return { fen: currentFen, step: currentStep, done: true };
          chessSounds.move();
          const nextStep = currentStep + 1;
          const done = nextStep >= moves.length;
          return { fen: c.fen(), step: nextStep, done };
        } catch {
          return { fen: currentFen, step: currentStep, done: true };
        }
      }
      return { fen: currentFen, step: currentStep, done: currentStep >= moves.length };
    },
    []
  );

  const onMove = useCallback(
    (uci: string): boolean => {
      if (!zadacha || status !== "play") return false;
      const expected = zadacha.moves[step]?.toLowerCase();
      if (!expected) return false;

      const tryPlay = (moveUci: string) => {
        const c = new Chess(fen);
        const from = moveUci.slice(0, 2);
        const to = moveUci.slice(2, 4);
        const promotion = moveUci.length > 4 ? moveUci[4] : undefined;
        const m = c.move({
          from,
          to,
          promotion: promotion as "q" | "r" | "b" | "n" | undefined,
        });
        return m ? c : null;
      };

      const isLastPlayerPly = step === zadacha.moves.length - 1 || step % 2 === 0;
      const allowAnyMate =
        isLastPlayerPly &&
        (zadacha.themes.includes("mateIn1") ||
          (zadacha.themes.includes("mate") && zadacha.moves.length - step <= 1));

      let played = tryPlay(uci);
      const matchesLine = uci.toLowerCase() === expected;

      if (!matchesLine) {
        // Lichess: any mating move wins mate-in-1 (not only the recorded UCI).
        if (!allowAnyMate || !played || !played.isCheckmate()) {
          chessSounds.illegal();
          setStatus("wrong");
          setSessionFail((n) => n + 1);
          void reportAttempt(false, zadacha.id);
          return false;
        }
      } else if (!played) {
        chessSounds.illegal();
        return false;
      }

      try {
        const mSan = played!.history({ verbose: true }).slice(-1)[0];
        if (mSan?.captured) chessSounds.capture();
        else chessSounds.move();
        if (played!.isCheck()) chessSounds.check();

        let nextFen = played!.fen();
        let nextStep = step + 1;

        // If we accepted an alternate mate-in-1, the line is done.
        if (!matchesLine && played!.isCheckmate()) {
          chessSounds.gameEnd();
          setFen(nextFen);
          setStep(zadacha.moves.length);
          setStatus("done");
          setSessionOk((n) => n + 1);
          void reportAttempt(true, zadacha.id);
          if (data?.daily && data.dailyKey) {
            setStreak(bumpStreak(data.dailyKey));
          }
          return true;
        }

        const after = playOpponentIfNeeded(nextStep, nextFen, zadacha.moves);
        nextFen = after.fen;
        nextStep = after.step;

        setFen(nextFen);
        setStep(nextStep);

        if (after.done || nextStep >= zadacha.moves.length) {
          chessSounds.gameEnd();
          setStatus("done");
          setSessionOk((n) => n + 1);
          void reportAttempt(true, zadacha.id);
          if (data?.daily && data.dailyKey) {
            setStreak(bumpStreak(data.dailyKey));
          }
        } else {
          setStatus("correct");
          setTimeout(() => setStatus("play"), 400);
        }
        return true;
      } catch {
        chessSounds.illegal();
        return false;
      }
    },
    [zadacha, status, step, fen, playOpponentIfNeeded, data]
  );

  const resetCurrent = () => {
    if (!zadacha) return;
    setFen(zadacha.fen);
    setStep(0);
    setStatus("play");
    setBoardKey((k) => k + 1);
  };

  return (
    <main className="page-bg min-h-screen px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link
            href="/"
            className="text-sm font-medium text-white/55 transition hover:text-white"
          >
            ← На главную
          </Link>
          <h1 className="flex items-center gap-2 font-display text-xl font-semibold text-white">
            <Lightbulb className="h-6 w-6 text-gold" />
            Задачи
          </h1>
          <div className="min-w-[5rem] text-right text-sm text-white/45">
            {sessionOk} / {sessionOk + sessionFail || "—"}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-sm text-white/50">
          {userRating != null && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
              Рейтинг задач: <span className="font-semibold text-gold">{userRating}</span>
              {lastDelta != null && (
                <span className={lastDelta >= 0 ? " text-emerald-400" : " text-red-300"}>
                  {" "}
                  {lastDelta >= 0 ? `+${lastDelta}` : lastDelta}
                </span>
              )}
            </span>
          )}
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
            Серия: <span className="font-semibold text-gold">{streak}</span>
          </span>
          {zadacha && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Сложность ~{zadacha.rating}
            </span>
          )}
        </div>

        <div className="mb-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDaily(true);
              setTheme(null);
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              daily
                ? "border border-gold bg-gold text-ink-900"
                : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            Задача дня
          </button>
          <button
            type="button"
            onClick={() => {
              setDaily(false);
              setTheme(null);
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              !daily && theme === null
                ? "border border-gold bg-gold text-ink-900"
                : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            Все темы
          </button>
          {(data?.themes ?? []).slice(0, 10).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setDaily(false);
                setTheme(t === theme ? null : t);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                !daily && theme === t
                  ? "border border-gold bg-gold text-ink-900"
                  : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {themeLabel(t)}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 text-center text-sm text-red-300">{error}</p>
        )}

        {loading && !zadacha && (
          <p className="text-center text-sm text-white/45">Загрузка задачи…</p>
        )}

        {zadacha && (
          <>
            <p className="mb-3 text-center text-sm text-white/50">
              Ваш ход
              {zadacha.themes.length > 0
                ? ` · ${zadacha.themes.map(themeLabel).join(", ")}`
                : ""}
              {zadacha.moves.length > 1
                ? ` · линия ${Math.ceil(zadacha.moves.length / 2)} ход(а)`
                : ""}
            </p>

            <div className="surface-board p-4">
              <div
                key={boardKey}
                className="mx-auto overflow-hidden border border-white/10 bg-white/5"
                style={{
                  width: "min(100vw - 2rem, 70vh, 480px)",
                  height: "min(100vw - 2rem, 70vh, 480px)",
                  touchAction: "manipulation",
                }}
              >
                <BoardShell
                  fen={fen}
                  orientation={orientation}
                  interactive={status === "play" || status === "correct"}
                  onMove={onMove}
                  lastMoveUci={lastMoveUci}
                  sizeStyle={{ width: "100%", height: "100%" }}
                />
              </div>

              {status === "done" && (
                <p className="mt-4 text-center text-lg font-semibold text-emerald-400">
                  Решено!
                </p>
              )}
              {status === "wrong" && (
                <p className="mt-4 text-center text-lg font-semibold text-red-300">
                  Неверно. Можно начать заново или взять следующую.
                </p>
              )}
              {status === "correct" && (
                <p className="mt-4 text-center text-sm font-medium text-gold">
                  Верно — продолжайте линию…
                </p>
              )}

              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={resetCurrent}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10"
                >
                  <RotateCcw className="h-4 w-4" />
                  Заново
                </button>
                <button
                  type="button"
                  disabled={loading || daily}
                  onClick={() => void loadNext(zadacha.id)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-gold-bright disabled:opacity-60"
                >
                  <SkipForward className="h-4 w-4" />
                  Следующая
                </button>
              </div>
            </div>

            {data?.source === "seed" && (
              <p className="mt-3 text-center text-xs text-white/35">
                Локальный набор (~15 задач). Для каталога из 12 000 задач Lichess выполните{" "}
                <code className="text-white/50">supabase-migration-zadachi.sql</code>
                {" "}и{" "}
                <code className="text-white/50">supabase-seed-zadachi-lichess.sql</code>.
              </p>
            )}
            {data?.source === "db" && (
              <p className="mt-3 text-center text-xs text-white/35">
                Каталог из базы · рейтинг задачи {zadacha?.rating}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
