"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  SOFT_SKILLS_STAR_SKILLS,
  formatCompetency,
} from "@/lib/softSkillsCompetencies";
import type { SoftSkillsStarSkillId } from "@/lib/softSkillsDisciplines";
import type { SoftSkillsRatingEntry } from "@/lib/softSkillsRatings";
import { softSkillsProfileHref } from "@/lib/softSkillsLinks";

type SortKey = SoftSkillsStarSkillId | "competency" | "discipline" | "composite";
type SortDir = "desc" | "asc";

type Props = {
  title?: string;
  rows: SoftSkillsRatingEntry[];
  emptyText?: string;
  showClass?: boolean;
  showTeam?: boolean;
};

function sortValue(row: SoftSkillsRatingEntry, key: SortKey, dir: SortDir): number {
  let raw: number | null | undefined;
  if (key === "composite") raw = row.points;
  else if (key === "competency") raw = row.competencyOverall;
  else if (key === "discipline") raw = row.disciplineIndex;
  else raw = row.competencies?.[key];
  if (raw == null || raw <= 0) return dir === "desc" ? -Infinity : Infinity;
  return raw;
}

function compareRows(a: SoftSkillsRatingEntry, b: SoftSkillsRatingEntry, key: SortKey, dir: SortDir) {
  const av = sortValue(a, key, dir);
  const bv = sortValue(b, key, dir);
  if (av !== bv) return dir === "desc" ? bv - av : av - bv;
  return (a.displayName || a.username || "").localeCompare(b.displayName || b.username || "", "ru");
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
  return dir === "desc" ? (
    <ArrowDown className="ml-1 inline h-3 w-3 text-gold" />
  ) : (
    <ArrowUp className="ml-1 inline h-3 w-3 text-gold" />
  );
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "center",
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey | null;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  const alignClass =
    align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";

  return (
    <th className={`px-1.5 py-3 font-semibold ${alignClass} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex max-w-full items-center leading-snug whitespace-normal transition hover:text-white ${
          activeKey === sortKey ? "text-gold" : ""
        } ${align === "right" ? "ml-auto" : align === "center" ? "mx-auto" : ""}`}
      >
        <span>{label}</span>
        <SortIcon active={activeKey === sortKey} dir={dir} />
      </button>
    </th>
  );
}

export default function SoftSkillsCompetencyLeaderboard({
  title,
  rows,
  emptyText = "Пока нет участников с оценками.",
  showClass = false,
  showTeam = false,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>("composite");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showCompetencyCols, setShowCompetencyCols] = useState(false);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const displayRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }, [rows, sortKey, sortDir]);

  const colCount = 4 + (showCompetencyCols ? SOFT_SKILLS_STAR_SKILLS.length : 0);

  return (
    <div className="surface overflow-hidden">
      {title && (
        <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-white">{title}</h2>
            <button
              type="button"
              onClick={() => setShowCompetencyCols((v) => !v)}
              className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
            >
              {showCompetencyCols ? "Скрыть компетенции" : "Показать компетенции"}
            </button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table
          className={`w-full table-fixed border-collapse ${
            showCompetencyCols ? "min-w-[900px]" : "min-w-[320px]"
          }`}
        >
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-semibold uppercase tracking-wide text-white/45">
              <th className="w-10 px-2 py-3 text-left font-semibold">#</th>
              <th className="px-2 py-3 text-left font-semibold">Участник</th>
              {showCompetencyCols &&
                SOFT_SKILLS_STAR_SKILLS.map((s) => (
                  <SortableHeader
                    key={s.id}
                    label={s.label}
                    sortKey={s.id}
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                ))}
              <SortableHeader
                label="Компет."
                sortKey="competency"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableHeader
                label="Дисцип."
                sortKey="discipline"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableHeader
                label="Итог"
                sortKey="composite"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-6 text-sm text-white/55">
                  {emptyText}
                </td>
              </tr>
            ) : (
              displayRows.map((r, index) => {
                const profileHref = softSkillsProfileHref(r.username);
                const label = r.displayName?.trim() || r.username || "Ученик";
                const comps = r.competencies;
                const rank =
                  sortKey && r.place > 0 ? index + 1 : r.place > 0 ? r.place : "—";

                return (
                  <tr
                    key={r.userId}
                    className={`transition hover:bg-white/[0.04] ${r.isProvisional ? "opacity-60" : ""}`}
                  >
                    <td className="px-2 py-2.5 text-sm font-semibold text-white/40">{rank}</td>
                    <td className="px-2 py-2.5">
                      <div className="truncate text-sm font-semibold text-white">
                        {profileHref ? (
                          <Link href={profileHref} className="hover:text-gold">
                            {label}
                          </Link>
                        ) : (
                          label
                        )}
                      </div>
                      {(showClass && r.className) || (showTeam && r.teamLabel) ? (
                        <div className="truncate text-[10px] text-white/40">
                          {showClass ? r.className : r.teamLabel}
                        </div>
                      ) : null}
                    </td>
                    {showCompetencyCols &&
                      SOFT_SKILLS_STAR_SKILLS.map((s) => (
                        <td
                          key={s.id}
                          className="px-1 py-2.5 text-center text-xs font-medium tabular-nums text-white/70"
                        >
                          {formatCompetency(comps?.[s.id] ?? null)}
                        </td>
                      ))}
                    <td className="px-1 py-2.5 text-center text-xs tabular-nums text-white/60">
                      {formatCompetency(r.competencyOverall ?? null)}
                    </td>
                    <td className="px-1 py-2.5 text-center text-xs tabular-nums text-white/60">
                      {formatCompetency(r.disciplineIndex ?? null)}
                    </td>
                    <td className="px-2 py-2.5 text-right text-sm font-bold tabular-nums text-gold">
                      {r.points > 0 ? formatCompetency(r.points) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
