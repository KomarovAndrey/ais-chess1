"use client";

import { useEffect, useState } from "react";
import {
  getDisciplineLabel,
  type SoftSkillsDisciplineEntry,
  type SoftSkillsDisciplineId,
  type SoftSkillsOutcome,
} from "@/lib/softSkillsDisciplines";
import SoftSkillsStarRating from "@/components/soft-skills/SoftSkillsStarRating";

type Props = {
  discipline: SoftSkillsDisciplineId;
  entry: SoftSkillsDisciplineEntry;
  onSave: (entry: SoftSkillsDisciplineEntry) => Promise<void>;
};

function OutcomeToggle({
  value,
  onChange,
}: {
  value: SoftSkillsOutcome;
  onChange: (v: SoftSkillsOutcome) => void;
}) {
  return (
    <div className="flex gap-2">
      {(["win", "lose"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? null : opt)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            value === opt
              ? opt === "win"
                ? "bg-emerald-600 text-white"
                : "bg-red-600 text-white"
              : "border border-white/10 bg-white/5 text-white/60"
          }`}
        >
          {opt === "win" ? "Win" : "Lose"}
        </button>
      ))}
    </div>
  );
}

function CounterField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-white/50">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-white/70"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          max={9999}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center text-sm text-white"
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-white/70"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function SoftSkillsDisciplineForm({ discipline, entry, onSave }: Props) {
  const [draft, setDraft] = useState(entry);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(entry);
  }, [entry]);

  function patch(partial: Partial<SoftSkillsDisciplineEntry>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await onSave(draft);
      setMessage("Сохранено");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h4 className="font-display text-sm font-semibold text-gold">{getDisciplineLabel(discipline)}</h4>

      <div className="mt-3 space-y-3">
        {discipline === "lumo" && (
          <>
            <div className="space-y-1">
              <label className="text-xs text-white/50">Результат (до 6 цифр)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={draft.resultValue}
                onChange={(e) =>
                  patch({ resultValue: e.target.value.replace(/\D/g, "").slice(0, 6) })
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="000000"
              />
            </div>
            <CounterField
              label="Счётчик ошибок"
              value={draft.errorCount}
              onChange={(errorCount) => patch({ errorCount })}
            />
          </>
        )}

        {discipline === "robo" && (
          <div className="space-y-1">
            <label className="text-xs text-white/50">Время</label>
            <input
              type="text"
              value={draft.timeValue}
              onChange={(e) => patch({ timeValue: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              placeholder="мм:сс"
            />
          </div>
        )}

        {discipline === "3d" && (
          <>
            <div className="space-y-1">
              <label className="text-xs text-white/50">Время команды</label>
              <input
                type="text"
                value={draft.teamTime}
                onChange={(e) => patch({ teamTime: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="мм:сс"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50">Личное время</label>
              <input
                type="text"
                value={draft.personalTime}
                onChange={(e) => patch({ personalTime: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="мм:сс"
              />
            </div>
          </>
        )}

        {discipline === "sport" && (
          <>
            <CounterField
              label="Счётчик голов"
              value={draft.goalsCount}
              onChange={(goalsCount) => patch({ goalsCount })}
            />
            <CounterField
              label="Счётчик ошибок"
              value={draft.sportErrorCount}
              onChange={(sportErrorCount) => patch({ sportErrorCount })}
            />
          </>
        )}

        <div className="space-y-1">
          <span className="text-xs text-white/50">Win / Lose</span>
          <OutcomeToggle value={draft.outcome} onChange={(outcome) => patch({ outcome })} />
        </div>

        <div className="border-t border-white/10 pt-3">
          <p className="mb-2 text-xs font-medium text-white/45">Soft Skills</p>
          <SoftSkillsStarRating
            stars={draft.stars}
            onChange={(skillId, value) =>
              patch({ stars: { ...draft.stars, [skillId]: value } })
            }
            disabled={saving}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        {message && (
          <span
            className={`text-xs ${message === "Сохранено" ? "text-emerald-300" : "text-red-300"}`}
          >
            {message}
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="ml-auto rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
