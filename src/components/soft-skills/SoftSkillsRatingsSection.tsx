import Link from "next/link";
import SoftSkillsLeaderboard from "@/components/soft-skills/SoftSkillsLeaderboard";
import {
  SOFT_SKILLS_LEAGUES,
  SOFT_SKILLS_MODULES,
  type SoftSkillsLeagueId,
  type SoftSkillsModuleId,
} from "@/lib/softSkillsModules";
import {
  buildClassBoard,
  buildModuleLeagueBoard,
  buildOverallBoard,
  buildTeamBoard,
  loadSoftSkillsRatingContext,
} from "@/lib/softSkillsRatings";

type SoftView = "module" | "overall" | "teams" | "classes";

export default async function SoftSkillsRatingsSection({
  searchParams,
}: {
  searchParams: { view?: string; module?: string; league?: string };
}) {
  const view: SoftView =
    searchParams.view === "overall" ||
    searchParams.view === "teams" ||
    searchParams.view === "classes" ||
    searchParams.view === "module"
      ? searchParams.view
      : "overall";

  const moduleId: SoftSkillsModuleId =
    SOFT_SKILLS_MODULES.find((m) => m.id === searchParams.module)?.id ?? "1";
  const leagueId: SoftSkillsLeagueId =
    SOFT_SKILLS_LEAGUES.find((l) => l.id === searchParams.league)?.id ?? "1";

  const ctx = await loadSoftSkillsRatingContext();
  const missingScores =
    ctx?.error?.includes("schema cache") ||
    ctx?.error?.includes("soft_skills_scores") ||
    ctx?.error?.includes("class_name");

  const base = "/ratings?section=soft-skills";

  return (
    <main className="page-bg min-h-screen">
      <div className="page-shell max-w-3xl">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="page-title">Рейтинги</h1>
            <p className="page-subtitle">Soft Skills</p>
          </div>
          <Link href="/" className="btn-secondary">
            На главную
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/ratings?section=chess&type=blitz" className="tab-pill">
            Шахматы
          </Link>
          <span className="tab-pill-active">Soft Skills</span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`${base}&view=overall`}
            className={view === "overall" ? "tab-pill-active" : "tab-pill"}
          >
            Общий
          </Link>
          <Link
            href={`${base}&view=module&module=${moduleId}&league=${leagueId}`}
            className={view === "module" ? "tab-pill-active" : "tab-pill"}
          >
            По модулю
          </Link>
          <Link
            href={`${base}&view=teams`}
            className={view === "teams" ? "tab-pill-active" : "tab-pill"}
          >
            По командам
          </Link>
          <Link
            href={`${base}&view=classes`}
            className={view === "classes" ? "tab-pill-active" : "tab-pill"}
          >
            По классам
          </Link>
        </div>

        {missingScores && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Выполните в Supabase SQL:{" "}
            <code className="text-amber-100">supabase-migration-soft-skills-ratings.sql</code>
          </div>
        )}

        {view === "overall" && (
          <SoftSkillsLeaderboard
            title="Общий рейтинг · сумма всех 6 модулей"
            rows={ctx ? buildOverallBoard(ctx.profiles, ctx.scores) : []}
            emptyText="Пока нет баллов. Дети появятся после начисления очков Soft Skills."
            showClass
          />
        )}

        {view === "module" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SOFT_SKILLS_MODULES.map((m) => (
                <Link
                  key={m.id}
                  href={`${base}&view=module&module=${m.id}&league=${leagueId}`}
                  className={moduleId === m.id ? "tab-pill-active" : "tab-pill"}
                >
                  {m.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {SOFT_SKILLS_LEAGUES.map((l) => (
                <Link
                  key={l.id}
                  href={`${base}&view=module&module=${moduleId}&league=${l.id}`}
                  className={leagueId === l.id ? "tab-pill-active" : "tab-pill"}
                >
                  {l.label}
                </Link>
              ))}
            </div>
            <SoftSkillsLeaderboard
              title={`${SOFT_SKILLS_MODULES.find((m) => m.id === moduleId)?.label} · ${
                SOFT_SKILLS_LEAGUES.find((l) => l.id === leagueId)?.label
              }`}
              rows={
                ctx
                  ? buildModuleLeagueBoard(ctx.profiles, ctx.scores, moduleId, leagueId)
                  : []
              }
              emptyText="В этой лиге модуля пока нет детей или баллов."
              showClass
            />
          </div>
        )}

        {view === "teams" && (
          <div className="space-y-4">
            {(ctx ? buildTeamBoard(ctx.profiles, ctx.scores, ctx.teams) : []).length === 0 ? (
              <div className="surface-pad text-sm text-white/55">
                Пока нет команд с участниками.
              </div>
            ) : (
              (ctx ? buildTeamBoard(ctx.profiles, ctx.scores, ctx.teams) : []).map((team) => (
                <SoftSkillsLeaderboard
                  key={`${team.leagueId}:${team.teamId}`}
                  title={`Команда «${team.teamLabel}» · Лига ${team.leagueId} · сумма ${team.points}`}
                  rows={team.members}
                  emptyText="Нет детей в команде."
                />
              ))
            )}
          </div>
        )}

        {view === "classes" && (
          <div className="space-y-4">
            {(ctx ? buildClassBoard(ctx.profiles, ctx.scores) : []).length === 0 ? (
              <div className="surface-pad text-sm text-white/55">
                Пока нет классов. Добавьте детям поле «Класс» при создании аккаунтов.
              </div>
            ) : (
              (ctx ? buildClassBoard(ctx.profiles, ctx.scores) : []).map((cls) => (
                <SoftSkillsLeaderboard
                  key={cls.className}
                  title={`Класс ${cls.className}`}
                  rows={cls.members}
                  emptyText="Нет детей в классе."
                />
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}
