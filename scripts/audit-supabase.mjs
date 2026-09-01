#!/usr/bin/env node
/**
 * Audits live Supabase project against tables/RPCs used by the app.
 * Usage: node scripts/audit-supabase.mjs
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

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

async function probeTable(admin, name) {
  const { count, error } = await admin.from(name).select("*", { count: "exact", head: true });
  if (error) return { ok: false, error: error.message.split(".")[0] };
  return { ok: true, rows: count ?? 0 };
}

async function probeRpc(admin, name, args) {
  const { error } = await admin.rpc(name, args);
  if (!error) return { ok: true };
  const msg = error.message.split("\n")[0];
  if (msg.includes("Could not find the function")) return { ok: false, missing: true, error: msg };
  return { ok: true, exists: true, note: msg };
}

const TABLES = [
  "profiles",
  "friend_requests",
  "user_reports",
  "reversi_games",
  "rate_limit_buckets",
  "soft_skills_teams",
  "soft_skills_team_members",
  "soft_skills_discipline_entries",
  "soft_skills_self_ratings",
];

const RPCS = [
  ["username_available", { check_username: "audit_probe_user" }],
  ["check_rate_limit_bucket", { bucket_key: "audit", max_count: 1, window_seconds: 60 }],
  ["heartbeat_presence", {}],
  ["resolve_login_email", { identifier: "student1" }],
];

const MIGRATION_HINTS = {
  check_rate_limit_bucket: "supabase-migration-trust-phase-g.sql",
  resolve_login_email: "supabase-migration-login-email-rpc.sql",
};

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("Supabase audit:", url);
console.log("");

console.log("=== Tables ===");
const tableIssues = [];
for (const t of TABLES) {
  const r = await probeTable(admin, t);
  if (r.ok) {
    console.log(`  OK  ${t} (${r.rows} rows)`);
  } else {
    console.log(`  FAIL ${t}: ${r.error}`);
    tableIssues.push(`missing table ${t}`);
  }
}

console.log("");
console.log("=== RPC functions ===");
const rpcMissing = [];
for (const [name, args] of RPCS) {
  const r = await probeRpc(admin, name, args);
  if (r.missing) {
    const hint = MIGRATION_HINTS[name] ? ` → run ${MIGRATION_HINTS[name]}` : "";
    console.log(`  MISSING ${name}${hint}`);
    rpcMissing.push(name);
  } else if (r.note) {
    console.log(`  OK  ${name} (${r.note})`);
  } else {
    console.log(`  OK  ${name}`);
  }
}

console.log("");
console.log("=== Profiles / roles ===");
const { data: users } = await admin.from("profiles").select("username, role");
for (const u of users ?? []) {
  console.log(`  ${u.username ?? "?"} → ${u.role ?? "?"}`);
}

console.log("");
if (tableIssues.length === 0 && rpcMissing.length === 0) {
  console.log("All checks passed.");
} else {
  console.log("Action items:");
  for (const item of [...new Set([...tableIssues, ...rpcMissing.map((r) => MIGRATION_HINTS[r] || r)])]) {
    console.log(`  - ${item}`);
  }
}
