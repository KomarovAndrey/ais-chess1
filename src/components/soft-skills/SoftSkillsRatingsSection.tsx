import Link from "next/link";
import SoftSkillsCompetencyLeaderboard from "@/components/soft-skills/SoftSkillsCompetencyLeaderboard";
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
  const missingData =
    ctx?.error?.includes("schema cache") ||
    ctx?.error?.includes("soft_skills_discipline_entries") ||
    ctx?.error?.includes("class_name");

  const base = "/ratings";

  return (
    <main className="page-bg min-h-screen">
      <div className="page-shell max-w-6xl">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="page-title">Рейтинги</h1>
            <p className="page-subtitle">Soft Skills · компетенции</p>
          </div>
          <Link href="/" className="btn-secondary">
            На главную
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`${base}?view=overall`}
            className={view === "overall" ? "tab-pill-active" : "tab-pill"}
          >
            Общий за год
          </Link>
          <Link
            href={`${base}?view=module&module=${moduleId}&league=${leagueId}`}
            className={view === "module" ? "tab-pill-active" : "tab-pill"}
          >
            По модулю
          </Link>
          <Link
            href={`${base}?view=teams`}
            className={view === "teams" ? "tab-pill-active" : "tab-pill"}
          >
            По командам
          </Link>
          <Link
            href={`${base}?view=classes`}
            className={view === "classes" ? "tab-pill-active" : "tab-pill"}
          >
            По классам
          </Link>
        </div>

        {missingData && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Выполните в Supabase SQL:{" "}
            <code className="text-amber-100">supabase-migration-soft-skills-disciplines.sql</code>
          </div>
        )}

        {view === "overall" && (
          <SoftSkillsCompetencyLeaderboard
            title="Общий рейтинг за год · композитный балл"
            rows={
              ctx
                ? buildOverallBoard(ctx.profiles, ctx.disciplineEntries, ctx.fullEntries)
                : []
            }
            emptyText="Пока нет оценок. Данные появятся после внесения результатов на неделе."
            showClass
          />
        )}

        {view === "module" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SOFT_SKILLS_MODULES.map((m) => (
                <Link
                  key={m.id}
                  href={`${base}?view=module&module=${m.id}&league=${leagueId}`}
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
                  href={`${base}?view=module&module=${moduleId}&league=${l.id}`}
                  className={leagueId === l.id ? "tab-pill-active" : "tab-pill"}
                >
                  {l.label}
                </Link>
              ))}
            </div>
            <SoftSkillsCompetencyLeaderboard
              title={`${SOFT_SKILLS_MODULES.find((m) => m.id === moduleId)?.label} · ${
                SOFT_SKILLS_LEAGUES.find((l) => l.id === leagueId)?.label
              }`}
              rows={
                ctx
                  ? buildModuleLeagueBoard(
                      ctx.profiles,
                      ctx.disciplineEntries,
                      ctx.fullEntries,
                      moduleId,
                      leagueId
                    )
                  : []
              }
              emptyText="В этой лиге модуля пока нет детей или оценок."
              showClass
            />
          </div>
        )}

        {view === "teams" && (
          <div className="space-y-4">
            {(ctx
              ? buildTeamBoard(
                  ctx.profiles,
                  ctx.disciplineEntries,
                  ctx.fullEntries,
                  ctx.teams
                )
              : []
            ).length === 0 ? (
              <div className="surface-pad text-sm text-white/55">
                Пока нет команд с участниками.
              </div>
            ) : (
              (ctx
                ? buildTeamBoard(
                    ctx.profiles,
                    ctx.disciplineEntries,
                    ctx.fullEntries,
                    ctx.teams
                  )
                : []
              ).map((team) => (
                  <SoftSkillsCompetencyLeaderboard
                    key={`${team.leagueId}:${team.teamId}`}
                    title={`Команда «${team.teamLabel}» · Лига ${team.leagueId}`}
                    rows={team.members}
                    emptyText="Нет детей в команде."
                  />
                )
              )
            )}
          </div>
        )}

        {view === "classes" && (
          <div className="space-y-4">
            {(ctx
              ? buildClassBoard(ctx.profiles, ctx.disciplineEntries, ctx.fullEntries)
              : []
            ).length === 0 ? (
              <div className="surface-pad text-sm text-white/55">
                Пока нет классов. Добавьте детям поле «Класс» при создании аккаунтов.
              </div>
            ) : (
              (ctx
                ? buildClassBoard(ctx.profiles, ctx.disciplineEntries, ctx.fullEntries)
                : []
              ).map((cls) => (
                <SoftSkillsCompetencyLeaderboard
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
