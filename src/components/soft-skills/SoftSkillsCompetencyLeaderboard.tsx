import Link from "next/link";
import {
  SOFT_SKILLS_STAR_SKILLS,
  formatCompetency,
} from "@/lib/softSkillsCompetencies";
import type { SoftSkillsRatingEntry } from "@/lib/softSkillsRatings";
import { softSkillsProfileHref } from "@/lib/softSkillsLinks";

type Props = {
  title?: string;
  rows: SoftSkillsRatingEntry[];
  emptyText?: string;
  showClass?: boolean;
  showTeam?: boolean;
};

export default function SoftSkillsCompetencyLeaderboard({
  title,
  rows,
  emptyText = "Пока нет участников с оценками.",
  showClass = false,
  showTeam = false,
}: Props) {
  return (
    <div className="surface overflow-hidden">
      {title && (
        <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <h2 className="font-display text-base font-semibold text-white">{title}</h2>
          <p className="mt-0.5 text-xs text-white/40">
            Средний балл по 5 компетенциям (шкала 0–5)
          </p>
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[40px_minmax(140px,1fr)_repeat(5,64px)_56px] gap-1 border-b border-white/10 bg-white/[0.02] px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/45">
            <div>#</div>
            <div>Участник</div>
            {SOFT_SKILLS_STAR_SKILLS.map((s) => (
              <div key={s.id} className="text-center leading-tight">
                {s.label.split(" ")[0]}
              </div>
            ))}
            <div className="text-right">Средн.</div>
          </div>
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-white/55">{emptyText}</div>
          ) : (
            <ul className="divide-y divide-white/5">
              {rows.map((r) => {
                const profileHref = softSkillsProfileHref(r.username);
                const label = r.displayName?.trim() || r.username || "Ученик";
                const comps = r.competencies;

                return (
                  <li
                    key={r.userId}
                    className="grid grid-cols-[40px_minmax(140px,1fr)_repeat(5,64px)_56px] items-center gap-1 px-3 py-2.5 transition hover:bg-white/[0.04]"
                  >
                    <div className="text-sm font-semibold text-white/40">{r.place}</div>
                    <div className="min-w-0">
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
                    </div>
                    {SOFT_SKILLS_STAR_SKILLS.map((s) => (
                      <div key={s.id} className="text-center text-xs font-medium text-white/70">
                        {formatCompetency(comps?.[s.id] ?? null)}
                      </div>
                    ))}
                    <div className="text-right text-sm font-bold text-gold">
                      {r.points > 0 ? formatCompetency(r.points) : "—"}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
