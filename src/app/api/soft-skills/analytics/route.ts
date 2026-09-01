import { NextRequest, NextResponse } from "next/server";
import { requireStaffAuth } from "@/lib/softSkillsAuth";
import {
  analyticsToCsv,
  buildClassHeatmaps,
  buildModuleComparison,
  buildWeekCompletion,
} from "@/lib/softSkillsAnalytics";
import { loadSoftSkillsRatingContext } from "@/lib/softSkillsRatings";
import { SOFT_SKILLS_MODULES } from "@/lib/softSkillsModules";

export async function GET(req: NextRequest) {
  const auth = await requireStaffAuth();
  if ("response" in auth) return auth.response;

  const moduleId = req.nextUrl.searchParams.get("module") ?? "1";
  const week = Number(req.nextUrl.searchParams.get("week") ?? "1");
  const format = req.nextUrl.searchParams.get("format");

  const ctx = await loadSoftSkillsRatingContext();
  if (!ctx || ctx.error) {
    return NextResponse.json({ error: ctx?.error ?? "no_db" }, { status: 500 });
  }

  const classHeatmaps = buildClassHeatmaps(ctx.profiles, ctx.disciplineEntries);
  const moduleComparison = buildModuleComparison(ctx.profiles, ctx.disciplineEntries);
  const weekCompletion = buildWeekCompletion(
    ctx.profiles,
    ctx.fullEntries,
    moduleId,
    Number.isFinite(week) ? week : 1
  );

  if (format === "csv") {
    const csv = analyticsToCsv(classHeatmaps, moduleComparison);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="soft-skills-analytics.csv"',
      },
    });
  }

  return NextResponse.json({
    classHeatmaps,
    moduleComparison,
    weekCompletion,
    modules: SOFT_SKILLS_MODULES,
    selectedModule: moduleId,
    selectedWeek: week,
  });
}
