#!/usr/bin/env node
/**
 * Seed Soft Skills demo students with classes, teams, discipline scores, and self-ratings.
 *
 * Usage:
 *   node scripts/seed-soft-skills-demo.mjs          # create demo data
 *   node scripts/seed-soft-skills-demo.mjs --clean  # remove demo_ss_* users
 *   node scripts/seed-soft-skills-demo.mjs --count=36
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DEMO_PREFIX = "demo_ss_";
const DEMO_PASSWORD = "DemoSeed2026!";
const DISCIPLINES = ["lumo", "robo", "sport", "3d"];
const STAR_KEYS = [
  "star_leadership",
  "star_communication",
  "star_self_reflection",
  "star_critical_thinking",
  "star_self_control",
];

const MODULES = [
  { id: "1", weeks: 7 },
  { id: "2", weeks: 7 },
  { id: "3", weeks: 6 },
  { id: "4", weeks: 6 },
  { id: "5", weeks: 5 },
  { id: "6", weeks: 5 },
];

const LEAGUES = ["1", "2", "3", "4"];

const TEAMS_BY_LEAGUE = {
  1: ["north", "south", "east", "west"],
  2: ["lightning", "thunder", "whirlwind", "storm"],
  3: ["falcon", "lynx", "puma", "hawk"],
  4: ["atlas", "titan", "phoenix", "comet"],
};

const CLASSES = ["5А", "5Б", "6А", "6Б", "7А", "7Б"];

const FIRST_NAMES = [
  "Артём",
  "Мария",
  "Иван",
  "София",
  "Дмитрий",
  "Анна",
  "Максим",
  "Елена",
  "Кирилл",
  "Полина",
  "Никита",
  "Виктория",
  "Алексей",
  "Дарья",
  "Егор",
  "Алина",
  "Роман",
  "Ксения",
  "Тимур",
  "Вероника",
  "Матвей",
  "Ольга",
  "Павел",
  "Юлия",
  "Глеб",
  "Наталья",
  "Фёдор",
  "Ева",
  "Степан",
  "Милана",
  "Лев",
  "Алиса",
  "Марк",
  "Валерия",
  "Ярослав",
  "Камилла",
  "Богдан",
  "Злата",
  "Владислав",
  "Амина",
  "Георгий",
  "Диана",
  "Семён",
  "Арина",
  "Илья",
  "Маргарита",
  "Даниил",
  "Карина",
];

function loadEnv() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    console.error("Missing .env.local");
    process.exit(1);
  }
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

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function clampStar(n) {
  return Math.max(1, Math.min(5, Math.round(n)));
}

function timeStr(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let clean = false;
  let count = 48;
  for (const arg of args) {
    if (arg === "--clean") clean = true;
    else if (arg.startsWith("--count=")) count = Number(arg.split("=")[1]) || 48;
  }
  return { clean, count: Math.max(12, Math.min(96, count)) };
}

async function listDemoUsers(admin) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, username")
    .like("username", `${DEMO_PREFIX}%`);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function cleanDemo(admin) {
  const users = await listDemoUsers(admin);
  if (users.length === 0) {
    console.log("No demo users to remove.");
    return;
  }
  console.log(`Removing ${users.length} demo users…`);
  for (const u of users) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) console.warn(`  skip ${u.username}: ${error.message}`);
    else console.log(`  deleted ${u.username}`);
  }
}

function buildDisciplinePayload(userId, moduleId, week, discipline, skill) {
  const outcome = Math.random() > 0.45 ? "win" : "lose";
  const stars = {};
  for (const key of STAR_KEYS) {
    stars[key] = clampStar(skill + randInt(-1, 1) + (Math.random() > 0.7 ? 1 : 0));
  }

  const base = {
    user_id: userId,
    module_id: moduleId,
    week_number: week,
    discipline,
    outcome,
    result_value: null,
    error_count: 0,
    time_value: null,
    team_time: null,
    personal_time: null,
    goals_count: 0,
    sport_error_count: 0,
    ...stars,
    teacher_note: Math.random() > 0.85 ? pick(["Хорошая работа", "Нужна поддержка", "Стабильный прогресс"]) : null,
    updated_at: new Date().toISOString(),
  };

  if (discipline === "lumo") {
    base.result_value = String(randInt(12, 98));
    base.error_count = randInt(0, 7);
  } else if (discipline === "robo") {
    base.time_value = timeStr(randInt(45, 240));
  } else if (discipline === "3d") {
    base.team_time = timeStr(randInt(90, 300));
    base.personal_time = timeStr(randInt(60, 240));
  } else if (discipline === "sport") {
    base.goals_count = randInt(0, 6);
    base.sport_error_count = randInt(0, 5);
  }

  return base;
}

async function upsertChunks(admin, table, rows, onConflict) {
  const chunkSize = 150;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await admin.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    process.stdout.write(`\r  ${table}: ${Math.min(i + chunk.length, rows.length)} / ${rows.length}`);
  }
  if (rows.length > 0) process.stdout.write("\n");
}

async function seed(admin, count) {
  const existing = await listDemoUsers(admin);
  if (existing.length > 0) {
    console.log(`Found ${existing.length} existing demo users — cleaning first…`);
    await cleanDemo(admin);
  }

  const students = [];
  console.log(`Creating ${count} demo students…`);

  for (let i = 0; i < count; i++) {
    const username = `${DEMO_PREFIX}${String(i + 1).padStart(2, "0")}`;
    const displayName = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${pick(["А.", "Б.", "В.", "Г."])}`;
    const email = `${username}@demo.ais-chess.local`;

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { username, display_name: displayName },
    });

    if (error) throw new Error(`createUser ${username}: ${error.message}`);

    const leagueId = LEAGUES[i % LEAGUES.length];
    const className = CLASSES[i % CLASSES.length];
    const teamId = TEAMS_BY_LEAGUE[leagueId][Math.floor(i / LEAGUES.length) % 4];
    const skill = randInt(2, 5);

    students.push({
      id: data.user.id,
      username,
      displayName,
      leagueId,
      className,
      teamId,
      skill,
    });
    process.stdout.write(`\r  users: ${i + 1} / ${count}`);
  }
  process.stdout.write("\n");

  console.log("Updating profiles…");
  for (const s of students) {
    const { error } = await admin
      .from("profiles")
      .update({
        class_name: s.className,
        soft_skills_league_id: s.leagueId,
        display_name: s.displayName,
        role: "student",
      })
      .eq("id", s.id);
    if (error) throw new Error(`profile ${s.username}: ${error.message}`);
  }

  console.log("Assigning teams (6 modules × student)…");
  const teamRows = [];
  for (const s of students) {
    for (const mod of MODULES) {
      teamRows.push({
        module_id: mod.id,
        league_id: s.leagueId,
        team_id: s.teamId,
        user_id: s.id,
        updated_at: new Date().toISOString(),
      });
    }
  }
  await upsertChunks(
    admin,
    "soft_skills_team_members",
    teamRows,
    "module_id,user_id"
  );

  console.log("Generating discipline entries…");
  const entryRows = [];
  for (const s of students) {
    for (const mod of MODULES) {
      for (let week = 1; week <= mod.weeks; week++) {
        for (const discipline of DISCIPLINES) {
          entryRows.push(buildDisciplinePayload(s.id, mod.id, week, discipline, s.skill));
        }
      }
    }
  }
  await upsertChunks(
    admin,
    "soft_skills_discipline_entries",
    entryRows,
    "user_id,module_id,week_number,discipline"
  );

  console.log("Generating self-ratings…");
  const selfRows = [];
  for (const s of students) {
    for (const mod of MODULES) {
      const row = {
        user_id: s.id,
        module_id: mod.id,
        updated_at: new Date().toISOString(),
      };
      for (const key of STAR_KEYS) {
        const short = key.replace("star_", "");
        const camel =
          short === "self_reflection"
            ? "self_reflection"
            : short === "critical_thinking"
              ? "critical_thinking"
              : short === "self_control"
                ? "self_control"
                : short;
        row[key] = clampStar(s.skill + randInt(-1, 2));
        void camel;
      }
      selfRows.push(row);
    }
  }
  await upsertChunks(admin, "soft_skills_self_ratings", selfRows, "user_id,module_id");

  console.log("\nDone.");
  console.log(`  Students: ${students.length}`);
  console.log(`  Team rows: ${teamRows.length}`);
  console.log(`  Discipline entries: ${entryRows.length}`);
  console.log(`  Self-ratings: ${selfRows.length}`);
  console.log(`  Login prefix: ${DEMO_PREFIX}01 … password: ${DEMO_PASSWORD}`);
  console.log(`  Classes: ${CLASSES.join(", ")}`);
  console.log(`  Open /ratings and /soft-skills/analytics to review charts.`);
}

async function main() {
  const { clean, count } = parseArgs();
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (clean) {
    await cleanDemo(admin);
    return;
  }

  await seed(admin, count);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
