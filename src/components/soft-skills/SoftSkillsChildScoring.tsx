"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  disciplinesForLeague,
  emptyEntryFor,
  type SoftSkillsDisciplineEntry,
  type SoftSkillsDisciplineId,
} from "@/lib/softSkillsDisciplines";
import SoftSkillsDisciplineForm from "@/components/soft-skills/SoftSkillsDisciplineForm";
import type { SoftSkillsModuleId } from "@/lib/softSkillsModules";

type Member = {
  id: string;
  username: string | null;
  display_name: string | null;
};

type Props = {
  member: Member;
  moduleId: SoftSkillsModuleId;
  week: number;
  leagueId: string;
  teamId: string;
  expanded: boolean;
  onToggle: () => void;
  label: string;
};

function memberLabel(m: Member) {
  return m.display_name?.trim() || m.username || "Ученик";
}

export default function SoftSkillsChildScoring({
  member,
  moduleId,
  week,
  leagueId,
  teamId,
  expanded,
  onToggle,
  label,
}: Props) {
  const disciplines = disciplinesForLeague(leagueId);
  const [entries, setEntries] = useState<Record<SoftSkillsDisciplineId, SoftSkillsDisciplineEntry>>(
    () =>
      Object.fromEntries(disciplines.map((d) => [d, emptyEntryFor(d)])) as Record<
        SoftSkillsDisciplineId,
        SoftSkillsDisciplineEntry
      >
  );
  const [loading, setLoading] = useState(false);

  const loadEntries = useCallback(() => {
    if (!expanded || disciplines.length === 0) return;
    setLoading(true);
    const params = new URLSearchParams({
      module: moduleId,
      week: String(week),
      league: leagueId,
      team: teamId,
    });
    fetch(`/api/soft-skills/entries?${params}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Не удалось загрузить оценки");
        const userEntries = data.entriesByUser?.[member.id];
        if (userEntries) {
          setEntries((prev) => ({ ...prev, ...userEntries }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [expanded, disciplines.length, moduleId, week, leagueId, teamId, member.id]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  async function saveDiscipline(entry: SoftSkillsDisciplineEntry) {
    const res = await fetch("/api/soft-skills/entries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: member.id,
        moduleId,
        week,
        leagueId,
        discipline: entry.discipline,
        entry,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Не удалось сохранить");
    if (data.entry) {
      setEntries((prev) => ({
        ...prev,
        [entry.discipline]: data.entry,
      }));
    }
  }

  if (disciplines.length === 0) {
    return (
      <li className="flex items-center gap-3 px-3 py-2.5 text-sm text-white/85">
        <span className="w-6 shrink-0 text-xs text-white/35">{label}</span>
        <span className="min-w-0 truncate font-medium">{memberLabel(member)}</span>
      </li>
    );
  }

  return (
    <li className="border-b border-white/5 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-white/85 transition hover:bg-white/[0.04]"
        aria-expanded={expanded}
      >
        <span className="w-6 shrink-0 text-xs text-white/35">{label}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{memberLabel(member)}</span>
        {member.username && (
          <span className="shrink-0 text-xs text-white/40">@{member.username}</span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gold transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-white/10 bg-black/20 px-3 py-3">
          {loading ? (
            <p className="text-sm text-white/45">Загрузка…</p>
          ) : (
            disciplines.map((discipline) => (
              <SoftSkillsDisciplineForm
                key={discipline}
                discipline={discipline}
                entry={entries[discipline] ?? emptyEntryFor(discipline)}
                onSave={saveDiscipline}
              />
            ))
          )}
        </div>
      )}
    </li>
  );
}
