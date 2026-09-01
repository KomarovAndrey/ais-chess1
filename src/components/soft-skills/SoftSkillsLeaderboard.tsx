import Link from "next/link";
import type { SoftSkillsRatingEntry } from "@/lib/softSkillsRatings";
import { softSkillsProfileHref } from "@/lib/softSkillsLinks";

type SoftSkillsLeaderboardProps = {
  title?: string;
  rows: SoftSkillsRatingEntry[];
  emptyText?: string;
  showClass?: boolean;
  showTeam?: boolean;
};

export default function SoftSkillsLeaderboard({
  title,
  rows,
  emptyText = "Пока нет участников.",
  showClass = false,
  showTeam = false,
}: SoftSkillsLeaderboardProps) {
  return (
    <div className="surface overflow-hidden">
      {title && (
        <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <h2 className="font-display text-base font-semibold text-white">{title}</h2>
        </div>
      )}
      <div
        className={`grid gap-0 border-b border-white/10 bg-white/[0.02] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/45 ${
          showClass || showTeam
            ? "grid-cols-[48px_1fr_auto_72px]"
            : "grid-cols-[48px_1fr_72px]"
        }`}
      >
        <div>#</div>
        <div>Участник</div>
        {(showClass || showTeam) && <div className="pr-2 text-right">Метка</div>}
        <div className="text-right">Балл</div>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-white/55">{emptyText}</div>
      ) : (
        <ul className="divide-y divide-white/5">
          {rows.map((r) => {
            const profileHref = softSkillsProfileHref(r.username);
            const label = r.displayName?.trim() || r.username || "Ученик";

            return (
            <li
              key={r.userId}
              className={`grid items-center px-4 py-3 transition hover:bg-white/[0.04] ${
                showClass || showTeam
                  ? "grid-cols-[48px_1fr_auto_72px]"
                  : "grid-cols-[48px_1fr_72px]"
              }`}
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
                {r.username && (
                  <div className="truncate text-xs text-white/45">
                    {profileHref ? (
                      <Link href={profileHref} className="hover:text-gold">
                        @{r.username}
                      </Link>
                    ) : (
                      `@${r.username}`
                    )}
                  </div>
                )}
              </div>
              {(showClass || showTeam) && (
                <div className="pr-2 text-right text-xs text-white/45">
                  {showClass ? r.className || "—" : r.teamLabel || "—"}
                </div>
              )}
              <div className="text-right text-sm font-bold text-gold">
                {Number.isInteger(r.points) ? r.points : r.points.toFixed(1)}
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
