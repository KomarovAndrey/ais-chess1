import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import * as XLSX from "xlsx";
import { normalizeWeekNumber } from "@/lib/weekly";

const PROGRAMS = ["Robo", "Lumo", "Sport", "3D"] as const;
const METRICS = [
  ["leadership", "Лидер"],
  ["communication", "Коммун"],
  ["self_reflection", "Самореф"],
  ["critical_thinking", "Крит мыш"],
  ["self_control", "Самокн"],
] as const;

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
  const { supabase, user } = auth;
  const { searchParams } = new URL(req.url);
  const weekNumber = normalizeWeekNumber(searchParams.get("week"));

  const { data, error } = await supabase
    .from("children")
    .select(
      `
        id,
        team_name,
        full_name,
        class_name,
        child_comments:child_comments(
          created_at,
          body,
          week_number,
          author:author_id(username, display_name)
        ),
        child_program_ratings:child_program_ratings(
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
          queue_order
        )
      `
    )
    .order("team_name", { ascending: true, nullsFirst: false })
    .order("full_name", { ascending: true })
    .order("created_at", { referencedTable: "child_comments", ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows =
    (data ?? []).map((c: any) => {
      const comments: any[] = Array.isArray(c.child_comments)
        ? c.child_comments.filter((cm: any) => cm.week_number === weekNumber)
        : [];
      const ratings: any[] = Array.isArray(c.child_program_ratings)
        ? c.child_program_ratings.filter(
            (rating: any) => rating.week_number === weekNumber && rating.evaluator_id === user.id
          )
        : [];
      const joined = comments
        .map((cm: any) => {
          const author = cm.author?.display_name || cm.author?.username || "—";
          const dt = cm.created_at ? new Date(cm.created_at).toLocaleString("ru-RU") : "";
          const body = (cm.body ?? "").toString();
          return `${dt} — ${author}: ${body}`;
        })
        .join("\n");

      const ratingColumns = Object.fromEntries(
        PROGRAMS.flatMap((program) => {
          const programRating = ratings.find((item) => item.program === program);
          const metricColumns = METRICS.map(([metricKey, metricLabel]) => [
            `${program} ${metricLabel}`,
            programRating?.[metricKey] && programRating[metricKey] !== "-" ? Number(programRating[metricKey]) : "",
          ]);

          if (program === "Sport") {
            return [
              ...metricColumns,
              ["Sport Result", programRating?.sport_result === "win" ? "Win" : programRating?.sport_result === "lose" ? "Lose" : ""],
              ["Sport Goals", Number.isFinite(Number(programRating?.sport_goals)) ? Number(programRating?.sport_goals) : 0],
              ["Sport Errors", Number.isFinite(Number(programRating?.sport_errors)) ? Number(programRating?.sport_errors) : 0],
            ];
          }

          if (program === "Robo" || program === "Lumo") {
            const q = programRating?.queue_order;
            return [
              ...metricColumns,
              [`${program} Очередность`, q !== null && q !== undefined && Number.isFinite(Number(q)) ? Number(q) : ""],
            ];
          }

          return metricColumns;
        })
      );

      return {
        Team: c.team_name ?? "",
        Name: c.full_name ?? "",
        Grade: c.class_name ?? "",
        "Комментарии": joined,
        ...ratingColumns,
      };
    }) ?? [];

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 16 },
    { wch: 28 },
    { wch: 14 },
    { wch: 80 },
    ...PROGRAMS.flatMap((program) =>
      program === "Sport"
        ? [...METRICS.map(() => ({ wch: 12 })), { wch: 12 }, { wch: 12 }, { wch: 12 }]
        : program === "Robo" || program === "Lumo"
          ? [...METRICS.map(() => ({ wch: 12 })), { wch: 12 }]
          : METRICS.map(() => ({ wch: 12 }))
    ),
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Дети");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const fileDate = new Date().toISOString().split("T")[0];

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="children-comments-week-${weekNumber}-${fileDate}.xlsx"`,
    },
  });
}

