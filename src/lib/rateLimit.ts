/**
 * Rate limiter per identifier (user id / IP).
 * Prefer Supabase RPC `check_rate_limit_bucket` when USE_DB_RATE_LIMIT=1 and service role is set;
 * otherwise in-memory (fine for single-instance / local).
 */

import { createAdminClient } from "@/lib/supabase/admin";

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;

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
