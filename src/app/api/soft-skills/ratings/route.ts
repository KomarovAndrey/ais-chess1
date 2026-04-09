import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeWeekNumber } from "@/lib/weekly";

// GET - получить все оценки (для учителей/админов)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase configuration error" }, { status: 500 });
  }
  const weekNumber = normalizeWeekNumber(request.nextUrl.searchParams.get("week"));
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Проверить роль
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["teacher", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Получить все оценки с информацией об оценивающем и ученике
  const { data: ratings, error } = await supabase
    .from("soft_skills_ratings")
    .select(`
      *,
      evaluator:evaluator_id(id, username, email),
      student:student_id(id, username, email)
    `)
    .eq("week_number", weekNumber)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ratings, week_number: weekNumber });
}

// POST - создать новую оценку
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase configuration error" }, { status: 500 });
  }
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Проверить роль
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["teacher", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await request.json();
  const { student_id, leadership, communication, self_reflection, critical_thinking, self_control } = body;
  const weekNumber = normalizeWeekNumber(body.week_number);

  if (!student_id) {
    return NextResponse.json({ error: "student_id is required" }, { status: 400 });
  }

  // One rating per evaluator/student/week. New week starts empty.
  const { data, error } = await supabase
    .from("soft_skills_ratings")
    .upsert(
      {
        evaluator_id: user.id,
        student_id,
        week_number: weekNumber,
        leadership: leadership || "-",
        communication: communication || "-",
        self_reflection: self_reflection || "-",
        critical_thinking: critical_thinking || "-",
        self_control: self_control || "-",
      },
      { onConflict: "evaluator_id,student_id,week_number" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rating: data });
}
