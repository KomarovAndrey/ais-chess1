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
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("children")
    .select(
      `
        id,
        full_name,
        class_name,
        child_comments:child_comments(
          created_at,
          body,
          author:author_id(username, display_name, email)
        )
      `
    )
    .order("full_name", { ascending: true })
    .order("created_at", { referencedTable: "child_comments", ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows =
    (data ?? []).map((c: any) => {
      const comments: any[] = Array.isArray(c.child_comments) ? c.child_comments : [];
      const joined = comments
        .map((cm) => {
          const author = cm.author?.display_name || cm.author?.username || cm.author?.email || "—";
          const dt = cm.created_at ? new Date(cm.created_at).toLocaleString("ru-RU") : "";
          const body = (cm.body ?? "").toString();
          return `${dt} — ${author}: ${body}`;
        })
        .join("\n");
      return {
        "Ребёнок": c.full_name ?? "",
        "Класс/группа": c.class_name ?? "",
        "Комментарии": joined,
      };
    }) ?? [];

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 80 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Дети");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const fileDate = new Date().toISOString().split("T")[0];

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="children-comments-${fileDate}.xlsx"`,
    },
  });
}

