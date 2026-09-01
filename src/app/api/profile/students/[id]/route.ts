import { NextRequest, NextResponse } from "next/server";
import { requireStaffAuth } from "@/lib/softSkillsAuth";

/** Staff: update student class_name. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffAuth();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Student id required" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const className =
    typeof body.class_name === "string" ? body.class_name.trim().slice(0, 32) : null;

  if (className === null) {
    return NextResponse.json({ error: "class_name required" }, { status: 400 });
  }

  const db = auth.admin ?? auth.supabase;
  const { data, error } = await db
    .from("profiles")
    .update({ class_name: className || null })
    .eq("id", id)
    .eq("role", "student")
    .select("id, username, display_name, class_name")
    .maybeSingle();

  if (error) {
    if (error.message?.includes("class_name")) {
      return NextResponse.json(
        { error: "Run supabase-migration-soft-skills-ratings.sql for class_name column" },
        { status: 500 }
      );
    }
    console.error("class_name update:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  return NextResponse.json({ student: data });
}
