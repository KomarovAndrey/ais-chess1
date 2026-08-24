"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { TIME_PRESETS } from "@/lib/timeControls";

const SIDE_OPTIONS: { id: "black" | "random" | "white"; label: string; icon: string }[] = [
  { id: "black", label: "Чёрные", icon: "♚" },
  { id: "random", label: "Случайный цвет", icon: "♔♚" },
  { id: "white", label: "Белые", icon: "♔" },
];

export type GameParams = {
  creatorColor: "white" | "black" | "random";
  timeControlSeconds: number;
  incrementSeconds: number;
  rated: boolean;
};

const GROUPS = ["Bullet", "Blitz", "Rapid"] as const;

export default function GameParamsModal(props: {
  open: boolean;
  title?: string;
  topContent?: ReactNode;
  submitLabel: string;
  submittingLabel?: string;
  initialCreatorColor?: "white" | "black" | "random";
  initialTimeControlSeconds?: number;
  initialIncrementSeconds?: number;
  initialRated?: boolean;
  showRatedToggle?: boolean;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  errorText?: string | null;
  onClose: () => void;
  onSubmit: (params: GameParams) => void | Promise<void>;
}) {
  const {
    open,
    title = "Параметры игры",
    topContent,
    submitLabel,
    submittingLabel = "Отправка…",
    initialCreatorColor = "random",
    initialTimeControlSeconds = 300,
    initialIncrementSeconds = 0,
    initialRated = true,
    showRatedToggle = true,
    isSubmitting = false,
    submitDisabled = false,
    errorText,
    onClose,
    onSubmit,
  } = props;

  const [creatorColor, setCreatorColor] = useState<"white" | "black" | "random">(initialCreatorColor);
  const [timeControlSeconds, setTimeControlSeconds] = useState(initialTimeControlSeconds);
  const [incrementSeconds, setIncrementSeconds] = useState(initialIncrementSeconds);
  const [rated, setRated] = useState(initialRated);

  useEffect(() => {
    if (!open) return;
    setCreatorColor(initialCreatorColor);
    setTimeControlSeconds(initialTimeControlSeconds);
    setIncrementSeconds(initialIncrementSeconds);
    setRated(initialRated);
  }, [open, initialCreatorColor, initialTimeControlSeconds, initialIncrementSeconds, initialRated]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  const selectedKey = useMemo(
    () => `${timeControlSeconds}+${incrementSeconds}`,
    [timeControlSeconds, incrementSeconds]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-ink-800 shadow-card">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="max-h-[85dvh] space-y-6 overflow-y-auto px-6 pb-6 pt-6">
          <div className="pb-2">
            <h3 className="text-center font-display text-xl font-semibold tracking-wide text-white">
              {title}
            </h3>
          </div>
          {topContent}
          <div>
            <p className="mb-3 text-center text-sm font-medium text-white/50">Контроль времени</p>
            <div className="space-y-3">
              {GROUPS.map((group) => (
                <div key={group}>
                  <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-white/35">
                    {group}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {TIME_PRESETS.filter((p) => p.group === group).map((opt) => {
                      const key = `${opt.seconds}+${opt.increment}`;
                      const active = selectedKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setTimeControlSeconds(opt.seconds);
                            setIncrementSeconds(opt.increment);
                          }}
                          className={`rounded-xl px-3 py-3 text-sm font-bold transition ${
                            active
                              ? "border border-gold bg-gold text-ink-900 shadow-glow"
                              : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-center text-sm font-medium text-white/50">Сторона</p>
            <div className="grid grid-cols-3 gap-2">
              {SIDE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCreatorColor(opt.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-4 text-sm font-medium transition ${
                    creatorColor === opt.id
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

          {showRatedToggle && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setRated(true)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  rated
                    ? "border border-gold bg-gold text-ink-900"
                    : "border border-white/10 bg-white/5 text-white/70"
                }`}
              >
                Рейтинговая
              </button>
              <button
                type="button"
                onClick={() => setRated(false)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  !rated
                    ? "border border-gold bg-gold text-ink-900"
                    : "border border-white/10 bg-white/5 text-white/70"
                }`}
              >
                Товарищеская
              </button>
            </div>
          )}

          <button
            type="button"
            disabled={isSubmitting || submitDisabled}
            onClick={() =>
              onSubmit({ creatorColor, timeControlSeconds, incrementSeconds, rated })
            }
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gold px-4 py-4 text-base font-semibold text-ink-900 shadow-glow transition hover:bg-gold-bright disabled:opacity-60"
          >
            {isSubmitting ? submittingLabel : submitLabel}
          </button>

          {errorText && <p className="text-center text-sm text-red-400">{errorText}</p>}
        </div>
      </div>
    </div>
  );
}
