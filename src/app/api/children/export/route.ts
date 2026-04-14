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

function baseTeacherLabel(rating: any) {
  const ev = rating?.evaluator;
  const s = (ev?.display_name || ev?.username || "").trim();
  return s || "—";
}

function uniqueEvaluatorSuffixes(
  entries: { id: string; baseLabel: string }[]
): Map<string, string> {
  const byBase = new Map<string, string[]>();
  for (const { id, baseLabel } of entries) {
    const list = byBase.get(baseLabel) ?? [];
    list.push(id);
    byBase.set(baseLabel, list);
  }
  const out = new Map<string, string>();
  for (const [, ids] of byBase) {
    if (ids.length === 1) {
      out.set(ids[0], entries.find((e) => e.id === ids[0])!.baseLabel);
    } else {
      for (const id of ids) {
        const base = entries.find((e) => e.id === id)!.baseLabel;
        out.set(id, `${base} (${id.slice(0, 8)})`);
      }
    }
  }
  return out;
}

export async function GET(req: Request) {
  const auth = await requireTeacherOrAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;
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
          queue_order,
          evaluator:evaluator_id(display_name, username)
        )
      `
    )
    .order("team_name", { ascending: true, nullsFirst: false })
    .order("full_name", { ascending: true })
    .order("created_at", { referencedTable: "child_comments", ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const evaluatorBase = new Map<string, string>();
  for (const c of data ?? []) {
    const rs: any[] = Array.isArray(c.child_program_ratings) ? c.child_program_ratings : [];
    for (const r of rs) {
      if (r.week_number !== weekNumber) continue;
      if (!evaluatorBase.has(r.evaluator_id)) {
        evaluatorBase.set(r.evaluator_id, baseTeacherLabel(r));
      }
    }
  }

  const evalEntries = [...evaluatorBase.entries()].map(([id, baseLabel]) => ({ id, baseLabel }));
  const suffixById = uniqueEvaluatorSuffixes(evalEntries);
  const evaluatorsSorted = [...evaluatorBase.keys()].sort((a, b) => {
    const sa = suffixById.get(a) ?? a;
    const sb = suffixById.get(b) ?? b;
    return sa.localeCompare(sb, "ru") || a.localeCompare(b);
  });

  type ColPick = { header: string; pick: (ratings: any[]) => string | number };
  const dynamicParts: ColPick[] = [];

  for (const eid of evaluatorsSorted) {
    const suffix = ` · ${suffixById.get(eid)}`;
    for (const program of PROGRAMS) {
      for (const [metricKey, metricLabel] of METRICS) {
        dynamicParts.push({
          header: `${program} ${metricLabel}${suffix}`,
          pick: (ratings) => {
            const pr = ratings.find((r) => r.program === program && r.evaluator_id === eid);
            return pr?.[metricKey] && pr[metricKey] !== "-" ? Number(pr[metricKey]) : "";
          },
        });
      }

      if (program === "Sport") {
        dynamicParts.push({
          header: `Sport Result${suffix}`,
          pick: (ratings) => {
            const pr = ratings.find((r) => r.program === program && r.evaluator_id === eid);
            return pr?.sport_result === "win" ? "Win" : pr?.sport_result === "lose" ? "Lose" : "";
          },
        });
        dynamicParts.push({
          header: `Sport Goals${suffix}`,
          pick: (ratings) => {
            const pr = ratings.find((r) => r.program === program && r.evaluator_id === eid);
            return Number.isFinite(Number(pr?.sport_goals)) ? Number(pr?.sport_goals) : "";
          },
        });
        dynamicParts.push({
          header: `Sport Errors${suffix}`,
          pick: (ratings) => {
            const pr = ratings.find((r) => r.program === program && r.evaluator_id === eid);
            return Number.isFinite(Number(pr?.sport_errors)) ? Number(pr?.sport_errors) : "";
          },
        });
      }

      if (program === "Robo" || program === "Lumo") {
        dynamicParts.push({
          header: `${program} Очередность${suffix}`,
          pick: (ratings) => {
            const pr = ratings.find((r) => r.program === program && r.evaluator_id === eid);
            const q = pr?.queue_order;
            return q !== null && q !== undefined && Number.isFinite(Number(q)) ? Number(q) : "";
          },
        });
      }
    }
  }

  const rows =
    (data ?? []).map((c: any) => {
      const comments: any[] = Array.isArray(c.child_comments)
        ? c.child_comments.filter((cm: any) => cm.week_number === weekNumber)
        : [];
      const ratings: any[] = Array.isArray(c.child_program_ratings)
        ? c.child_program_ratings.filter((rating: any) => rating.week_number === weekNumber)
        : [];
      const joined = comments
        .map((cm: any) => {
          const author = cm.author?.display_name || cm.author?.username || "—";
          const dt = cm.created_at ? new Date(cm.created_at).toLocaleString("ru-RU") : "";
          const body = (cm.body ?? "").toString();
          return `${dt} — ${author}: ${body}`;
        })
        .join("\n");

      const row: Record<string, string | number> = {
        Team: c.team_name ?? "",
        Name: c.full_name ?? "",
        Grade: c.class_name ?? "",
        "Комментарии": joined,
      };

      for (const part of dynamicParts) {
        row[part.header] = part.pick(ratings);
      }

      return row;
    }) ?? [];

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 16 },
    { wch: 28 },
    { wch: 14 },
    { wch: 80 },
    ...dynamicParts.map(() => ({ wch: 11 })),
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
