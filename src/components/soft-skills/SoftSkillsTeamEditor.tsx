"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Minus, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SOFT_SKILLS_LEAGUES,
  SOFT_SKILLS_MODULES,
  getSoftSkillsTeams,
  type SoftSkillsLeagueId,
  type SoftSkillsModuleId,
} from "@/lib/softSkillsModules";

type Student = {
  id: string;
  username: string | null;
  display_name: string | null;
  soft_skills_league_id?: string | null;
};

type SoftSkillsTeamEditorProps = {
  open: boolean;
  onClose: () => void;
};

function studentLabel(s: Student) {
  return s.display_name?.trim() || s.username || "Ученик";
}

export default function SoftSkillsTeamEditor({ open, onClose }: SoftSkillsTeamEditorProps) {
  const [moduleId, setModuleId] = useState<SoftSkillsModuleId>("1");
  const [leagueId, setLeagueId] = useState<SoftSkillsLeagueId>("1");
  const [teamId, setTeamId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const teams = useMemo(() => getSoftSkillsTeams(leagueId) ?? [], [leagueId]);
  const leagueLabel =
    SOFT_SKILLS_LEAGUES.find((l) => l.id === leagueId)?.label ?? `Лига ${leagueId}`;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setOk(null);
  }, [open]);

  useEffect(() => {
    if (!teams.length) return;
    if (!teams.some((t) => t.id === teamId)) {
      setTeamId(teams[0].id);
    }
  }, [teams, teamId]);

  useEffect(() => {
    if (!open || !teamId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOk(null);

    fetch(
      `/api/soft-skills/teams?module=${encodeURIComponent(moduleId)}&league=${encodeURIComponent(leagueId)}&team=${encodeURIComponent(teamId)}`
    )
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Не удалось загрузить данные.");
        if (cancelled) return;
        setStudents(Array.isArray(data.students) ? data.students : []);
        setMemberIds(Array.isArray(data.memberIds) ? data.memberIds : []);
        if (typeof data.error === "string" && data.error.includes("миграц")) {
          setError(data.error);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка загрузки");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, moduleId, leagueId, teamId]);

  const memberSet = useMemo(() => new Set(memberIds), [memberIds]);
  const inTeam = students.filter((s) => memberSet.has(s.id));
  const available = students.filter((s) => !memberSet.has(s.id));

  function addMember(id: string) {
    setMemberIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setOk(null);
  }

  function removeMember(id: string) {
    setMemberIds((prev) => prev.filter((x) => x !== id));
    setOk(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/soft-skills/teams", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, leagueId, teamId, memberIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить.");
      setOk("Команда сохранена. Дети привязаны к этой лиге.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/75 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative mx-0 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-ink-800 shadow-card sm:mx-4 sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-white">Редактор команд</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1.5">
                <span className="label-dark">Модуль</span>
                <select
                  value={moduleId}
                  onChange={(e) => setModuleId(e.target.value as SoftSkillsModuleId)}
                  className="input-dark"
                >
                  {SOFT_SKILLS_MODULES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="label-dark">Лига</span>
                <select
                  value={leagueId}
                  onChange={(e) => setLeagueId(e.target.value as SoftSkillsLeagueId)}
                  className="input-dark"
                >
                  {SOFT_SKILLS_LEAGUES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="label-dark">Команда</span>
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="input-dark"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {loading ? (
              <p className="text-sm text-white/45">Загрузка…</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="surface overflow-hidden">
                  <div className="border-b border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-white">
                    В команде ({inTeam.length})
                  </div>
                  <ul className="max-h-64 overflow-y-auto divide-y divide-white/5">
                    {inTeam.length === 0 ? (
                      <li className="px-3 py-4 text-sm text-white/40">Пока никого нет</li>
                    ) : (
                      inTeam.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-white/90">{studentLabel(s)}</p>
                            {s.username && (
                              <p className="truncate text-xs text-white/40">@{s.username}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMember(s.id)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
                            aria-label={`Убрать ${studentLabel(s)}`}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                <div className="surface overflow-hidden">
                  <div className="border-b border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-white">
                    Доступны для {leagueLabel} ({available.length})
                  </div>
                  <ul className="max-h-64 overflow-y-auto divide-y divide-white/5">
                    {available.length === 0 ? (
                      <li className="px-3 py-4 text-sm text-white/40">
                        Нет свободных детей этой лиги (или без лиги)
                      </li>
                    ) : (
                      available.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-white/90">{studentLabel(s)}</p>
                            {s.username && (
                              <p className="truncate text-xs text-white/40">@{s.username}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => addMember(s.id)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 transition hover:bg-emerald-500/20"
                            aria-label={`Добавить ${studentLabel(s)}`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}
            {ok && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                {ok}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 px-5 py-4">
            <Button
              type="submit"
              variant="default"
              size="lg"
              className="w-full justify-center gap-2"
              disabled={saving || loading || !teamId}
            >
              <Save className="h-4 w-4" />
              {saving ? "Сохраняем…" : "Сохранить команду"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
