import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isStaffRole, resolveUserRole } from "@/lib/roles";
import { SOFT_SKILLS_STAR_SKILLS } from "@/lib/softSkillsDisciplines";
import { isValidModuleId } from "@/lib/softSkillsModules";
import { clampStar } from "@/lib/softSkillsDisciplineDb";

type SelfRatingRow = {
  module_id: string;
  star_leadership: number;
  star_communication: number;
  star_self_reflection: number;
  star_critical_thinking: number;
  star_self_control: number;
  updated_at: string;
};

function rowToPayload(row: SelfRatingRow) {
  const stars = {
    leadership: row.star_leadership,
    communication: row.star_communication,
    selfReflection: row.star_self_reflection,
    criticalThinking: row.star_critical_thinking,
    selfControl: row.star_self_control,
  };
  const values = Object.values(stars).filter((v) => v >= 1);
  const overall =
    values.length > 0
      ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
      : null;

  return { moduleId: row.module_id, stars, overall, updatedAt: row.updated_at };
}

/** GET self-ratings for a student (self or staff). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "User id required" }, { status: 400 });
  }

  if (auth.user.id !== userId) {
    const { data: row } = await auth.supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();
    const role = await resolveUserRole(
      auth.supabase,
      auth.user.id,
      typeof row?.role === "string" ? row.role : null
    );
    if (!isStaffRole(role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  const moduleId = req.nextUrl.searchParams.get("module")?.trim();

  let query = auth.supabase
    .from("soft_skills_self_ratings")
    .select(
      "module_id, star_leadership, star_communication, star_self_reflection, star_critical_thinking, star_self_control, updated_at"
    )
    .eq("user_id", userId);

  if (moduleId && isValidModuleId(moduleId)) {
    query = query.eq("module_id", moduleId);
  }

  const { data, error } = await query;

  if (error) {
    const missing = error.message?.includes("soft_skills_self_ratings");
    return NextResponse.json(
      {
        error: missing
          ? "Выполните supabase-migration-soft-skills-self-ratings.sql в Supabase."
          : "Не удалось загрузить самооценку.",
        byModule: {},
      },
      { status: missing ? 500 : 500 }
    );
  }

  const byModule: Record<string, ReturnType<typeof rowToPayload>> = {};
  for (const row of (data ?? []) as SelfRatingRow[]) {
    byModule[row.module_id] = rowToPayload(row);
  }

  return NextResponse.json({ byModule, skills: SOFT_SKILLS_STAR_SKILLS });
}

/** PUT upsert self-rating for current user on one module. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;

  const { userId } = await params;
  if (auth.user.id !== userId) {
    return NextResponse.json({ error: "Можно сохранять только свою самооценку." }, { status: 403 });
  }

  let body: { moduleId?: string; stars?: Record<string, number> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const moduleId = body.moduleId?.trim() ?? "";
  if (!isValidModuleId(moduleId)) {
    return NextResponse.json({ error: "Неверный модуль." }, { status: 400 });
  }

  const stars = body.stars ?? {};
  const payload = {
    user_id: userId,
    module_id: moduleId,
    star_leadership: clampStar(stars.leadership ?? 0),
    star_communication: clampStar(stars.communication ?? 0),
    star_self_reflection: clampStar(stars.selfReflection ?? 0),
    star_critical_thinking: clampStar(stars.criticalThinking ?? 0),
    star_self_control: clampStar(stars.selfControl ?? 0),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.supabase
    .from("soft_skills_self_ratings")
    .upsert(payload, { onConflict: "user_id,module_id" })
    .select(
      "module_id, star_leadership, star_communication, star_self_reflection, star_critical_thinking, star_self_control, updated_at"
    )
    .single();

  if (error) {
    const missing = error.message?.includes("soft_skills_self_ratings");
    return NextResponse.json(
      {
        error: missing
          ? "Выполните supabase-migration-soft-skills-self-ratings.sql в Supabase."
          : "Не удалось сохранить.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ rating: rowToPayload(data as SelfRatingRow) });
}
