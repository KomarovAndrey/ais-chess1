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

const TEAM_HEADERS = new Set(["team", "команда"]);
const NAME_HEADERS = new Set(["name", "ребёнок", "ребенок", "фио", "имя"]);
const GRADE_HEADERS = new Set(["grade", "класс/группа", "класс", "группа", "class"]);

function childKey(row: { team_name: string | null; full_name: string; class_name: string | null }) {
  return `${(row.team_name ?? "").trim().toLowerCase()}|${row.full_name.trim().toLowerCase()}|${(row.class_name ?? "").trim().toLowerCase()}`;
}

function extractRowsFromSheet(sheet: XLSX.WorkSheet) {
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  let headerRowIndex = -1;
  let columnGroupStarts: number[] = [];

  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 10); rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const starts: number[] = [];

    for (let col = 0; col <= row.length - 3; col += 1) {
      const first = normalizeHeader(row[col]);
      const second = normalizeHeader(row[col + 1]);
      const third = normalizeHeader(row[col + 2]);

      if (TEAM_HEADERS.has(first) && NAME_HEADERS.has(second) && GRADE_HEADERS.has(third)) {
        starts.push(col);
      }
    }

    if (starts.length > 0) {
      headerRowIndex = rowIndex;
      columnGroupStarts = starts;
      break;
    }
  }

  if (headerRowIndex < 0 || columnGroupStarts.length === 0) {
    return [];
  }

  const rows: { team_name: string | null; full_name: string; class_name: string | null }[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];

    for (const col of columnGroupStarts) {
      const teamName = String(row[col] ?? "").trim();
      const fullName = String(row[col + 1] ?? "").trim();
      const className = String(row[col + 2] ?? "").trim();

      if (!teamName && !fullName && !className) continue;
      if (!fullName) continue;

      rows.push({
        team_name: teamName ? teamName.slice(0, 50) : null,
        full_name: fullName.slice(0, 200),
        class_name: className ? className.slice(0, 50) : null,
      });
    }
  }

  return rows;
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

  const toInsert = extractRowsFromSheet(sheet);
  if (!Array.isArray(toInsert) || toInsert.length === 0) {
    return NextResponse.json({ error: "No valid rows found. Check Team / Name / Grade columns." }, { status: 400 });
  }

  // Simple dedupe within file
  const seen = new Set<string>();
  const deduped = toInsert.filter((r) => {
    const key = childKey(r);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const { data: existingRows, error: existingError } = await supabase
    .from("children")
    .select("team_name, full_name, class_name");
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const existingKeys = new Set(
    (existingRows ?? []).map((row) =>
      childKey({
        team_name: row.team_name,
        full_name: row.full_name,
        class_name: row.class_name,
      })
    )
  );

  const onlyNewRows = deduped.filter((row) => !existingKeys.has(childKey(row)));

  if (onlyNewRows.length > 0) {
    const { error } = await supabase.from("children").insert(onlyNewRows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    inserted: onlyNewRows.length,
    skipped_existing: deduped.length - onlyNewRows.length,
    skipped_in_file: toInsert.length - deduped.length,
  });
}

