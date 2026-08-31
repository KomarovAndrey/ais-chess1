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

export async function GET() {
  const auth = await requireTeacherOrAdmin();
  if ("response" in auth) return auth.response;

  const layout = [
    {
      label: "KG1-G1",
      startCol: 0,
      rows: [
        ["Iron", "Самир", "1B"],
        ["Copper", "Илария", "1B"],
        ["Iridium", "Эмилия", "1A"],
        ["Tungsten", "Катерина", "1B"],
      ],
    },
    {
      label: "G2-G3",
      startCol: 4,
      rows: [
        ["Titanium", "Ренат", "2A"],
        ["Copper", "Яна А", "2A"],
        ["Tungsten", "Артем Т", "3"],
        ["Nickel", "Яна К", "2A"],
      ],
    },
    {
      label: "G4-G6",
      startCol: 8,
      rows: [
        ["Nitrogen", "David", "6"],
        ["Krypton", "Висса", "6"],
        ["Neon", "Платон", "5"],
        ["Oxygen", "Ваня", "4"],
      ],
    },
  ];

  const totalRows = Math.max(...layout.map((section) => section.rows.length)) + 2;
  const totalCols = 11;
  const matrix = Array.from({ length: totalRows }, () => Array.from({ length: totalCols }, () => ""));

  for (const section of layout) {
    matrix[0][section.startCol] = section.label;
    matrix[1][section.startCol] = "Team";
    matrix[1][section.startCol + 1] = "Name";
    matrix[1][section.startCol + 2] = "Grade";

    section.rows.forEach((row, index) => {
      matrix[index + 2][section.startCol] = row[0];
      matrix[index + 2][section.startCol + 1] = row[1];
      matrix[index + 2][section.startCol + 2] = row[2];
    });
  }

  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  worksheet["!merges"] = layout.map((section) => ({
    s: { r: 0, c: section.startCol },
    e: { r: 0, c: section.startCol + 2 },
  }));
  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 10 },
    { wch: 3 },
    { wch: 14 },
    { wch: 22 },
    { wch: 10 },
    { wch: 3 },
    { wch: 14 },
    { wch: 22 },
    { wch: 10 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Children Template");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="children-import-template.xlsx"',
    },
  });
}

