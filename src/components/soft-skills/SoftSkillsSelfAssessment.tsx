"use client";

import { useEffect, useState } from "react";
import { SOFT_SKILLS_STAR_SKILLS } from "@/lib/softSkillsDisciplines";
import SoftSkillsStarRating from "@/components/soft-skills/SoftSkillsStarRating";
import { formatCompetency } from "@/lib/softSkillsCompetencies";
import type { SoftSkillsModuleId } from "@/lib/softSkillsModules";

type SelfRating = {
  stars: Record<string, number>;
  overall: number | null;
};

type Props = {
  userId: string;
  moduleId: SoftSkillsModuleId | "overall";
  teacherOverall: number | null;
  isOwnProfile: boolean;
};

export default function SoftSkillsSelfAssessment({
  userId,
  moduleId,
  teacherOverall,
  isOwnProfile,
}: Props) {
  const [rating, setRating] = useState<SelfRating | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeModule = moduleId === "overall" ? "1" : moduleId;

  useEffect(() => {
    if (moduleId === "overall") {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/soft-skills/users/${userId}/self-ratings?module=${activeModule}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
        const r = data.byModule?.[activeModule];
        if (r) {
          setRating(r);
          setDraft(r.stars ?? {});
        } else {
          setRating(null);
          setDraft({});
        }
      })
      .catch(() => {
        setRating(null);
        setDraft({});
      })
      .finally(() => setLoading(false));
  }, [userId, activeModule, moduleId]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/soft-skills/users/${userId}/self-ratings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: activeModule, stars: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Ошибка сохранения");
      setRating(data.rating);
      setMessage("Сохранено");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  if (moduleId === "overall") return null;

  const selfOverall = rating?.overall ?? null;
  const delta =
    selfOverall != null && teacherOverall != null
      ? Math.round((selfOverall - teacherOverall) * 10) / 10
      : null;

  return (
    <div className="surface-pad">
      <h2 className="font-display text-lg font-semibold text-white">Самооценка</h2>

      {loading ? (
        <p className="mt-3 text-sm text-white/55">Загрузка…</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
              <p className="text-xs text-white/45">Самооценка</p>
              <p className="font-display text-xl font-semibold text-white">
                {formatCompetency(selfOverall)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
              <p className="text-xs text-white/45">Оценка педагога</p>
              <p className="font-display text-xl font-semibold text-gold">
                {formatCompetency(teacherOverall)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
              <p className="text-xs text-white/45">Разница</p>
              <p
                className={`font-display text-xl font-semibold ${
                  delta == null
                    ? "text-white/40"
                    : delta > 0.2
                      ? "text-amber-300"
                      : delta < -0.2
                        ? "text-emerald-300"
                        : "text-white"
                }`}
              >
                {delta != null ? (delta > 0 ? `+${delta}` : String(delta)) : "—"}
              </p>
            </div>
          </div>

          {isOwnProfile ? (
            <div className="mt-4 space-y-3">
              <SoftSkillsStarRating
                stars={draft as Record<string, number>}
                onChange={(skillId, value) =>
                  setDraft((prev) => ({ ...prev, [skillId]: value }))
                }
                disabled={saving}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Сохранение…" : "Сохранить самооценку"}
                </button>
                {message && (
                  <span
                    className={`text-xs ${message === "Сохранено" ? "text-emerald-300" : "text-red-300"}`}
                  >
                    {message}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {SOFT_SKILLS_STAR_SKILLS.map((s) => (
                <div key={s.id} className="flex justify-between text-sm text-white/60">
                  <span>{s.label}</span>
                  <span>{formatCompetency(rating?.stars?.[s.id] ?? null)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
