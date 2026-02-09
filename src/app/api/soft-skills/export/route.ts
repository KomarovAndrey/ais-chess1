import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

// GET - экспорт в Excel (только для учителей/админов)
export async function GET() {
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

  // Получить все оценки с джойнами
  const { data: ratings, error } = await supabase
    .from("soft_skills_ratings")
    .select(`
      id,
      leadership,
      communication,
      self_reflection,
      critical_thinking,
      self_control,
      created_at,
      evaluator:evaluator_id(username, email),
      student:student_id(username, email)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Преобразовать данные для Excel
  const excelData = ratings?.map((r: any) => ({
    "Дата оценки": new Date(r.created_at).toLocaleString("ru-RU"),
    "Оценивающий (username)": r.evaluator?.username || "-",
    "Оценивающий (email)": r.evaluator?.email || "-",
    "Ученик (username)": r.student?.username || "-",
    "Ученик (email)": r.student?.email || "-",
    "Лидерство": r.leadership || "-",
    "Коммуникация": r.communication || "-",
    "Саморефлексия": r.self_reflection || "-",
    "Критическое мышление": r.critical_thinking || "-",
    "Самоконтроль": r.self_control || "-",
  })) || [];

  // Создать Excel workbook
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Soft Skills");

  // Сгенерировать буфер
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  // Вернуть файл
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="soft-skills-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}
