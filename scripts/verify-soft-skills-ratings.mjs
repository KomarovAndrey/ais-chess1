#!/usr/bin/env node
/** Quick sanity check for Soft Skills ratings data coverage. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadEnv() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) process.exit(1);
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.trim().startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

async function fetchCount(admin, table) {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function fetchAllEntries(admin) {
  const pageSize = 1000;
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from("soft_skills_discipline_entries")
      .select("user_id")
      .order("user_id")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function main() {
  const env = loadEnv();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const students = await admin
    .from("profiles")
    .select("id, username, soft_skills_league_id")
    .eq("role", "student")
    .not("username", "is", null);

  const totalEntries = await fetchCount(admin, "soft_skills_discipline_entries");
  const rows = await fetchAllEntries(admin);
  const usersWithEntries = new Set(rows.map((r) => r.user_id));

  console.log("Students:", students.data?.length ?? 0);
  console.log("Discipline entries (total):", totalEntries);
  console.log("Discipline entries (fetched):", rows.length);
  console.log("Students with >=1 entry:", usersWithEntries.size);
  console.log(
    "Students with league:",
    (students.data ?? []).filter((s) => s.soft_skills_league_id).length
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
