import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import * as XLSX from "xlsx";

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

function normalizeHeader(h: unknown) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function POST(req: Request) {
  const auth = await requireTeacherOrAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buf, { type: "buffer" });
  } catch {
    return NextResponse.json({ error: "Invalid xlsx file" }, { status: 400 });
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet) return NextResponse.json({ error: "No sheets found" }, { status: 400 });

  const raw: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "Empty sheet" }, { status: 400 });
  }

  // Template columns: Team / Name / Grade
  const toInsert: { team_name: string | null; full_name: string; class_name: string | null }[] = [];
  for (const r of raw) {
    const keys = Object.keys(r ?? {});
    const map = new Map(keys.map((k) => [normalizeHeader(k), k]));

    const teamKey =
      map.get("team") ||
      map.get("команда");

    const nameKey =
      map.get("name") ||
      map.get("ребёнок") ||
      map.get("ребенок") ||
      map.get("фио") ||
      map.get("имя");

    const classKey =
      map.get("grade") ||
      map.get("класс/группа") ||
      map.get("класс") ||
      map.get("группа") ||
      map.get("class");

    const teamName = teamKey ? String(r[teamKey] ?? "").trim() : "";
    const fullName = nameKey ? String(r[nameKey] ?? "").trim() : "";
    const className = classKey ? String(r[classKey] ?? "").trim() : "";

    if (!fullName) continue;
    toInsert.push({
      team_name: teamName ? teamName.slice(0, 50) : null,
      full_name: fullName.slice(0, 200),
      class_name: className ? className.slice(0, 50) : null,
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ error: "No valid rows found" }, { status: 400 });
  }

  // Simple dedupe within file
  const seen = new Set<string>();
  const deduped = toInsert.filter((r) => {
    const key = `${(r.team_name ?? "").toLowerCase()}|${r.full_name.toLowerCase()}|${(r.class_name ?? "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const { error } = await supabase.from("children").insert(deduped);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inserted: deduped.length });
}

