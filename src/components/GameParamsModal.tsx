"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { ReactNode } from "react";

const SIDE_OPTIONS: { id: "black" | "random" | "white"; label: string; icon: string }[] = [
  { id: "black", label: "Чёрные", icon: "♚" },
  { id: "random", label: "Случайный цвет", icon: "♔♚" },
  { id: "white", label: "Белые", icon: "♔" }
];

const TIME_GROUPS: { title: string; options: { seconds: number; label: string }[] }[] = [
  { title: "Bullet", options: [{ seconds: 60, label: "1 мин" }, { seconds: 120, label: "2 мин" }] },
  { title: "Blitz", options: [{ seconds: 180, label: "3 мин" }, { seconds: 300, label: "5 мин" }] },
  { title: "Rapid", options: [{ seconds: 600, label: "10 мин" }, { seconds: 900, label: "15 мин" }] }
];

export type GameParams = {
  creatorColor: "white" | "black" | "random";
  timeControlSeconds: number;
};

export default function GameParamsModal(props: {
  open: boolean;
  title?: string;
  topContent?: ReactNode;
  submitLabel: string;
  submittingLabel?: string;
  initialCreatorColor?: "white" | "black" | "random";
  initialTimeControlSeconds?: number;
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
    isSubmitting = false,
    submitDisabled = false,
    errorText,
    onClose,
    onSubmit
  } = props;

  const [creatorColor, setCreatorColor] = useState<"white" | "black" | "random">(initialCreatorColor);
  const [timeControlSeconds, setTimeControlSeconds] = useState<number>(initialTimeControlSeconds);

  useEffect(() => {
    if (!open) return;
    setCreatorColor(initialCreatorColor);
    setTimeControlSeconds(initialTimeControlSeconds);
  }, [open, initialCreatorColor, initialTimeControlSeconds]);

  const modalOpen = open;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

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

  const allTimeOptions = useMemo(() => TIME_GROUPS.flatMap((g) => g.options), []);

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

        <div className="max-h-[85dvh] overflow-y-auto px-6 pt-6 pb-6 space-y-6">
          <div className="pb-2">
            <h3 className="text-center font-display text-xl font-semibold tracking-wide text-white">
              {title}
            </h3>
          </div>
          {topContent}
          <div>
            <p className="mb-3 text-center text-sm font-medium text-white/50">
              Время
            </p>

            <div className="space-y-3">
              {TIME_GROUPS.map((group) => (
                <div key={group.title}>
                  <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-white/35">
                    {group.title}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.options.map((opt) => (
                      <button
                        key={opt.seconds}
                        type="button"
                        onClick={() => setTimeControlSeconds(opt.seconds)}
                        className={`rounded-xl px-3 py-3 text-sm font-bold transition ${
                          timeControlSeconds === opt.seconds
                            ? "border border-gold bg-gold text-ink-900 shadow-glow"
                            : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {!allTimeOptions.some((o) => o.seconds === timeControlSeconds) && (
              <p className="mt-2 text-center text-xs text-white/40">
                Выбрано нестандартное время: {Math.floor(timeControlSeconds / 60)} мин
              </p>
            )}
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

          <button
            type="button"
            disabled={isSubmitting || submitDisabled}
            onClick={() => onSubmit({ creatorColor, timeControlSeconds })}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gold px-4 py-4 text-base font-semibold text-ink-900 shadow-glow transition hover:bg-gold-bright disabled:opacity-60"
          >
            {isSubmitting ? submittingLabel : submitLabel}
          </button>

          {errorText && (
            <p className="text-center text-sm text-red-400">{errorText}</p>
          )}
        </div>
      </div>
    </div>
  );
}

