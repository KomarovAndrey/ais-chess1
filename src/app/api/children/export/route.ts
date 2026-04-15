import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import * as XLSX from "xlsx";
import { MAX_ACTIVE_WEEK, MIN_ACTIVE_WEEK, unitLabelForWeek, weeksExportRange } from "@/lib/weekly";

function winLoseLabel(v: string | null | undefined) {
  if (v === "win") return "Win";
  if (v === "lose") return "Lose";
  return "";
}

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

/** Общая выгрузка: по одной строке на (ребёнок × неделя 31–40), колонки как в отчётной таблице. */
export async function GET() {
  const auth = await requireTeacherOrAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const weeks = weeksExportRange();

  const { data, error } = await supabase
    .from("children")
    .select(
      `
        id,
        team_name,
        full_name,
        class_name,
        child_program_ratings:child_program_ratings(
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
    .order("full_name", { ascending: true })
    ;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const headers = [
    "ФИ",
    "Unit",
    "Количество пропусков за 2 юнит",
    "Grade",
    "Неделя",

    "LUMO",
    "LUMO Результат",
    "LUMO Очередь",
    "LUMO Ошибки",
    "LUMO Комментарий",

    "Robo",
    "Robo Время",
    "Robo Очередь",
    "Robo Комментарий",

    "SPORT",
    "SPORT Голы",
    "SPORT Ошибки",
    "SPORT Комментарий",

    "3D",
    "3D Время команды",
    "3D Время участника",
    "3D Комментарий",

    "Lumo Лидер",
    "Lumo Коммун",
    "Lumo Самореф",
    "Lumo Крит мыш",
    "Lumo Самокн",

    "Robo Лидер",
    "Robo Коммун",
    "Robo Самореф",
    "Robo Крит мыш",
    "Robo Самокн",

    "Sport Лидер",
    "Sport Коммун",
    "Sport Самореф",
    "Sport Крит мыш",
    "Sport Самокн",

    "3D Лидер",
    "3D Коммун",
    "3D Самореф",
    "3D Крит мыш",
    "3D Самокн",
  ] as const;

  const rows: Record<string, string | number>[] = [];

  for (const c of data ?? []) {
    const allRatings: any[] = Array.isArray(c.child_program_ratings) ? c.child_program_ratings : [];

    for (const week of weeks) {
      const ratings = allRatings.filter((r: any) => r.week_number === week);

      const pick = (program: string) => ratings.find((r: any) => r.program === program) ?? null;

      const lumo = pick("Lumo");
      const robo = pick("Robo");
      const sport = pick("Sport");
      const d3 = pick("3D");

      const metricNum = (row: any, key: string) =>
        row?.[key] && row[key] !== "-" ? Number(row[key]) : "";

      const base = {
        ФИ: c.full_name ?? "",
        Unit: unitLabelForWeek(week),
        "Количество пропусков за 2 юнит": "",
        Grade: c.class_name ?? "",
        Неделя: week,
      } as const;

      // Одна таблица: сначала "как на фото", затем компетенции
      rows.push({
        ...base,
        LUMO: winLoseLabel(lumo?.sport_result),
        "LUMO Результат":
          lumo?.lumo_numeric_result !== null && lumo?.lumo_numeric_result !== undefined
            ? Number(lumo.lumo_numeric_result)
            : "",
        "LUMO Очередь":
          lumo?.queue_order !== null && lumo?.queue_order !== undefined ? Number(lumo.queue_order) : "",
        "LUMO Ошибки": Number.isFinite(Number(lumo?.lumo_errors)) ? Number(lumo.lumo_errors) : "",
        "LUMO Комментарий": (lumo?.program_comment ?? "").toString(),

        Robo: winLoseLabel(robo?.sport_result),
        "Robo Время": (robo?.robo_duration_text ?? "").toString(),
        "Robo Очередь":
          robo?.queue_order !== null && robo?.queue_order !== undefined ? Number(robo.queue_order) : "",
        "Robo Комментарий": (robo?.program_comment ?? "").toString(),

        SPORT: winLoseLabel(sport?.sport_result),
        "SPORT Голы": Number.isFinite(Number(sport?.sport_goals)) ? Number(sport.sport_goals) : "",
        "SPORT Ошибки": Number.isFinite(Number(sport?.sport_errors)) ? Number(sport.sport_errors) : "",
        "SPORT Комментарий": (sport?.program_comment ?? "").toString(),

        "3D": winLoseLabel(d3?.sport_result),
        "3D Время команды": (d3?.d3_team_time ?? "").toString(),
        "3D Время участника": (d3?.d3_participant_time ?? "").toString(),
        "3D Комментарий": (d3?.program_comment ?? "").toString(),

        "Lumo Лидер": metricNum(lumo, "leadership"),
        "Lumo Коммун": metricNum(lumo, "communication"),
        "Lumo Самореф": metricNum(lumo, "self_reflection"),
        "Lumo Крит мыш": metricNum(lumo, "critical_thinking"),
        "Lumo Самокн": metricNum(lumo, "self_control"),

        "Robo Лидер": metricNum(robo, "leadership"),
        "Robo Коммун": metricNum(robo, "communication"),
        "Robo Самореф": metricNum(robo, "self_reflection"),
        "Robo Крит мыш": metricNum(robo, "critical_thinking"),
        "Robo Самокн": metricNum(robo, "self_control"),

        "Sport Лидер": metricNum(sport, "leadership"),
        "Sport Коммун": metricNum(sport, "communication"),
        "Sport Самореф": metricNum(sport, "self_reflection"),
        "Sport Крит мыш": metricNum(sport, "critical_thinking"),
        "Sport Самокн": metricNum(sport, "self_control"),

        "3D Лидер": metricNum(d3, "leadership"),
        "3D Коммун": metricNum(d3, "communication"),
        "3D Самореф": metricNum(d3, "self_reflection"),
        "3D Крит мыш": metricNum(d3, "critical_thinking"),
        "3D Самокн": metricNum(d3, "self_control"),
      });
    }
  }

  // Явно фиксируем порядок колонок, чтобы Excel не создавал "вторую таблицу"
  // из-за разного порядка ключей/заголовков.
  const aoa: (string | number)[][] = [
    [...headers],
    ...rows.map((row) =>
      headers.map((key) => {
        const value = row[key];
        return value === undefined || value === null ? "" : (value as any);
      })
    ),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const colsCount = headers.length;
  worksheet["!cols"] = Array(colsCount).fill({ wch: 14 });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Дети");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const fileDate = new Date().toISOString().split("T")[0];

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="children-weeks-${MIN_ACTIVE_WEEK}-${MAX_ACTIVE_WEEK}-${fileDate}.xlsx"`,
    },
  });
}
