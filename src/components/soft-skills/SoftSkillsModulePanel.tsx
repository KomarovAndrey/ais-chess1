"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  SOFT_SKILLS_LEAGUES,
  type SoftSkillsModule,
} from "@/lib/softSkillsModules";

type Member = {
  id: string;
  username: string | null;
  display_name: string | null;
};

type TeamRoster = {
  id: string;
  label: string;
  members: Member[];
};

type SoftSkillsModulePanelProps = {
  module: SoftSkillsModule;
};

function memberLabel(m: Member) {
  return m.display_name?.trim() || m.username || "Ученик";
}

export default function SoftSkillsModulePanel({ module }: SoftSkillsModulePanelProps) {
  const [week, setWeek] = useState(1);
  const [openLeagueIds, setOpenLeagueIds] = useState<Set<string>>(() => new Set());
  const [openTeamIds, setOpenTeamIds] = useState<Set<string>>(() => new Set());
  const [teamsByLeague, setTeamsByLeague] = useState<Record<string, TeamRoster[]>>({});
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const maxWeek = module.weeks;

  const weekLabel = useMemo(() => `Неделя ${week}`, [week]);

  const loadRoster = useCallback(() => {
    setLoadingRoster(true);
    setRosterError(null);
    fetch(`/api/soft-skills/roster?module=${encodeURIComponent(module.id)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Не удалось загрузить команды.");
        const map: Record<string, TeamRoster[]> = {};
        for (const league of data.leagues ?? []) {
          map[league.id] = Array.isArray(league.teams) ? league.teams : [];
        }
        setTeamsByLeague(map);
      })
      .catch((e) => {
        setRosterError(e instanceof Error ? e.message : "Ошибка загрузки");
        setTeamsByLeague({});
      })
      .finally(() => setLoadingRoster(false));
  }, [module.id]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  function toggleLeague(id: string) {
    setOpenLeagueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTeam(leagueId: string, teamId: string) {
    const key = `${leagueId}:${teamId}`;
    setOpenTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="surface-pad">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-white/70">{weekLabel}</p>
          <p className="text-xs text-white/40">1–{maxWeek}</p>
        </div>
        <input
          type="range"
          min={1}
          max={maxWeek}
          step={1}
          value={week}
          onChange={(e) => setWeek(Number(e.target.value))}
          className="soft-skills-week-slider w-full"
          aria-label={`Неделя модуля, от 1 до ${maxWeek}`}
        />
        <div className="mt-2 flex justify-between text-[11px] text-white/35">
          {Array.from({ length: maxWeek }, (_, i) => (
            <span key={i + 1}>{i + 1}</span>
          ))}
        </div>
      </div>

      {rosterError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {rosterError}
        </div>
      )}

      <div className="space-y-3">
        {SOFT_SKILLS_LEAGUES.map((league) => {
          const open = openLeagueIds.has(league.id);
          const teams = teamsByLeague[league.id] ?? [];
          const filledCount = teams.filter((t) => t.members.length > 0).length;

          return (
            <div key={league.id} className="surface overflow-hidden">
              <button
                type="button"
                onClick={() => toggleLeague(league.id)}
                className="flex w-full items-center justify-between gap-3 bg-white/[0.03] px-4 py-3.5 text-left transition active:bg-white/[0.06]"
                aria-expanded={open}
              >
                <div className="min-w-0">
                  <h2 className="font-display text-base font-semibold text-white">
                    {league.label}
                  </h2>
                  <p className="mt-0.5 text-xs text-white/40">
                    {module.label} · {weekLabel}
                    {!loadingRoster && filledCount > 0
                      ? ` · команд с детьми: ${filledCount}`
                      : ""}
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-gold transition-transform duration-200 ${
                    open ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </button>

              {open && (
                <div className="space-y-2 border-t border-white/10 p-3">
                  {loadingRoster ? (
                    <p className="px-1 py-3 text-sm text-white/45">Загрузка команд…</p>
                  ) : teams.length === 0 ? (
                    <p className="px-1 py-3 text-sm text-white/55">Пока нет команд в лиге.</p>
                  ) : (
                    teams.map((team) => {
                      const teamKey = `${league.id}:${team.id}`;
                      const teamOpen = openTeamIds.has(teamKey);
                      return (
                        <div
                          key={team.id}
                          className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                        >
                          <button
                            type="button"
                            onClick={() => toggleTeam(league.id, team.id)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition active:bg-white/[0.05]"
                            aria-expanded={teamOpen}
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-white">{team.label}</p>
                              <p className="text-xs text-white/40">
                                {team.members.length === 0
                                  ? "Нет детей"
                                  : `${team.members.length} ${
                                      team.members.length === 1 ? "ребёнок" : "детей"
                                    }`}
                              </p>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-white/50 transition-transform duration-200 ${
                                teamOpen ? "rotate-180" : ""
                              }`}
                              aria-hidden
                            />
                          </button>

                          {teamOpen && (
                            <ul className="divide-y divide-white/5 border-t border-white/10">
                              {team.members.length === 0 ? (
                                <li className="px-3 py-3 text-sm text-white/45">
                                  Состав пуст. Добавьте детей в редакторе команд.
                                </li>
                              ) : (
                                team.members.map((m, idx) => (
                                  <li
                                    key={m.id}
                                    className="flex items-center gap-3 px-3 py-2.5 text-sm text-white/85"
                                  >
                                    <span className="w-6 shrink-0 text-xs text-white/35">
                                      {idx + 1}
                                    </span>
                                    <span className="min-w-0 truncate font-medium">
                                      {memberLabel(m)}
                                    </span>
                                    {m.username && (
                                      <span className="shrink-0 text-xs text-white/40">
                                        @{m.username}
                                      </span>
                                    )}
                                  </li>
                                ))
                              )}
                            </ul>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
