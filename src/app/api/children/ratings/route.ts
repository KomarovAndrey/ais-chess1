import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { normalizeWeekNumber } from "@/lib/weekly";

const PROGRAMS = new Set(["Robo", "Lumo", "Sport", "3D"]);

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

function normalizeScore(value: unknown) {
  const normalized = String(value ?? "-").trim();
  return ["1", "2", "3", "4", "5", "-"].includes(normalized) ? normalized : "-";
}

export async function POST(req: NextRequest) {
  const auth = await requireTeacherOrAdmin();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  let body: {
    child_id?: string;
    week_number?: number;
    program?: string;
    leadership?: string;
    communication?: string;
    self_reflection?: string;
    critical_thinking?: string;
    self_control?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const childId = typeof body.child_id === "string" ? body.child_id : "";
  const program = typeof body.program === "string" ? body.program : "";
  const weekNumber = normalizeWeekNumber(body.week_number);

  if (!childId) return NextResponse.json({ error: "child_id is required" }, { status: 400 });
  if (!PROGRAMS.has(program)) return NextResponse.json({ error: "program is invalid" }, { status: 400 });

  const payload = {
    child_id: childId,
    evaluator_id: user.id,
    week_number: weekNumber,
    program,
    leadership: normalizeScore(body.leadership),
    communication: normalizeScore(body.communication),
    self_reflection: normalizeScore(body.self_reflection),
    critical_thinking: normalizeScore(body.critical_thinking),
    self_control: normalizeScore(body.self_control),
  };

  const { data, error } = await supabase
    .from("child_program_ratings")
    .upsert(payload, { onConflict: "child_id,evaluator_id,week_number,program" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rating: data });
}
