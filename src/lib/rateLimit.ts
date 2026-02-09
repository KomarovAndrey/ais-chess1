/**
 * Simple in-memory rate limiter per identifier (e.g. user id).
 * For production at scale, use Redis or Supabase/Edge rate limiting.
 */

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60;

const store = new Map<
  string,
  { count: number; resetAt: number }
>();

function getWindowKey(id: string): { count: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(id);
  if (entry && now < entry.resetAt) {
    return entry;
  }
  const resetAt = now + WINDOW_MS;
  const newEntry = { count: 0, resetAt };
  store.set(id, newEntry);
  return newEntry;
}

/**
 * Returns true if the request is within limit, false if rate limited.
 * Call this with user id (or other identifier) and return 429 if false.
 */
export function checkRateLimit(identifier: string): boolean {
  const window = getWindowKey(identifier);
  if (window.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  window.count += 1;
  return true;
}
