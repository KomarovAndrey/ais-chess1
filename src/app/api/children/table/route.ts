import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { normalizeWeekNumber } from "@/lib/weekly";

async function requireTeacherOrAdmin() {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth;

  const { supabase, user } = auth;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["teacher", "admin"].includes(profile.role)) {
    return { response: NextResponse.json({ error: "Access denied" }, { status: 403 }) } as const;
  }

  return auth;
}

export async function GET(req: Request) {
  const auth = await requireTeacherOrAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
  const { searchParams } = new URL(req.url);
  const weekNumber = normalizeWeekNumber(searchParams.get("week"));

  const { data, error } = await supabase
    .from("children")
    .select(
      `
        id,
        created_at,
        team_name,
        full_name,
        class_name,
        child_program_ratings:child_program_ratings(
          id,
          evaluator_id,
          week_number,
          program,
          leadership,
          communication,
          self_reflection,
          critical_thinking,
          self_control,
          sport_result,
          sport_goals,
          sport_errors,
          queue_order,
          lumo_numeric_result,
          lumo_errors,
          robo_duration_text,
          d3_team_time,
          d3_participant_time,
          program_comment
        )
      `
    )
    .order("team_name", { ascending: true, nullsFirst: false })
    .order("full_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const children =
    (data ?? []).map((child: any) => ({
      ...child,
      child_program_ratings: Array.isArray(child.child_program_ratings)
        ? child.child_program_ratings.filter((rating: any) => rating.week_number === weekNumber)
        : [],
    })) ?? [];

  return NextResponse.json({ children, week_number: weekNumber });
}
