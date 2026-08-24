"use client";

import { TIME_PRESETS } from "@/lib/timeControls";

const GROUPS = ["Bullet", "Blitz", "Rapid"] as const;

export default function TimePresetPicker(props: {
  seconds: number;
  increment: number;
  onChange: (seconds: number, increment: number) => void;
  label?: string;
}) {
  const { seconds, increment, onChange, label = "Контроль времени" } = props;
  const selectedKey = `${seconds}+${increment}`;

  return (
    <div>
      <p className="mb-3 text-center text-sm font-medium text-white/50">{label}</p>
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
                    onClick={() => onChange(opt.seconds, opt.increment)}
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
  );
}
