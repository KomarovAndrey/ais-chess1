/**
 * Rate limiter per identifier (user id / IP).
 * Prefer Supabase RPC `check_rate_limit_bucket` when USE_DB_RATE_LIMIT=1 and service role is set;
 * otherwise in-memory (fine for single-instance / local).
 */

import { createAdminClient } from "@/lib/supabase/admin";

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS_PER_WINDOW = 10;

const store = new Map<string, { count: number; resetAt: number }>();

function checkInMemory(identifier: string): boolean {
  const now = Date.now();
  let entry = store.get(identifier);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(identifier, entry);
  }
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) return false;
  entry.count += 1;
  return true;
}

/**
 * Returns true if within limit, false if rate limited.
 */
export async function checkRateLimit(identifier: string): Promise<boolean> {
  if (!identifier) return false;

  if (process.env.USE_DB_RATE_LIMIT === "1") {
    const admin = createAdminClient();
    if (admin) {
      const { data, error } = await admin.rpc("check_rate_limit_bucket", {
        p_key: identifier,
        p_limit: MAX_REQUESTS_PER_WINDOW,
        p_window_seconds: 60,
      });
      if (!error && typeof data === "boolean") return data;
    }
  }

  return checkInMemory(identifier);
}

function checkLoginInMemory(identifier: string): boolean {
  const now = Date.now();
  const key = `login:${identifier}`;
  let entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    store.set(key, entry);
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS_PER_WINDOW) return false;
  entry.count += 1;
  return true;
}

/** Stricter limit for login attempts (per IP). */
export async function checkLoginRateLimit(identifier: string): Promise<boolean> {
  if (!identifier) return false;

  if (process.env.USE_DB_RATE_LIMIT === "1") {
    const admin = createAdminClient();
    if (admin) {
      const { data, error } = await admin.rpc("check_rate_limit_bucket", {
        p_key: `login:${identifier}`,
        p_limit: MAX_LOGIN_ATTEMPTS_PER_WINDOW,
        p_window_seconds: LOGIN_WINDOW_MS / 1000,
      });
      if (!error && typeof data === "boolean") return data;
    }
  }

  return checkLoginInMemory(identifier);
}

const PUBLIC_READ_WINDOW_MS = 60 * 1000;
const MAX_PUBLIC_READS_PER_WINDOW = 30;

function checkPublicReadInMemory(identifier: string): boolean {
  const now = Date.now();
  const key = `public:${identifier}`;
  let entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + PUBLIC_READ_WINDOW_MS };
    store.set(key, entry);
  }
  if (entry.count >= MAX_PUBLIC_READS_PER_WINDOW) return false;
  entry.count += 1;
  return true;
}

/** Rate limit for unauthenticated public GET endpoints (per IP). */
export async function checkPublicReadRateLimit(identifier: string): Promise<boolean> {
  if (!identifier) return false;

  if (process.env.USE_DB_RATE_LIMIT === "1") {
    const admin = createAdminClient();
    if (admin) {
      const { data, error } = await admin.rpc("check_rate_limit_bucket", {
        p_key: `public:${identifier}`,
        p_limit: MAX_PUBLIC_READS_PER_WINDOW,
        p_window_seconds: PUBLIC_READ_WINDOW_MS / 1000,
      });
      if (!error && typeof data === "boolean") return data;
    }
  }

  return checkPublicReadInMemory(identifier);
}

export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
