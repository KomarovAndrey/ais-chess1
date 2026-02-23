/**
 * Supabase client for anonymous access only (no cookies/session).
 * Use for Reversi play-by-link so opponents without auth can create/join/read games.
 */
import { createClient } from "@supabase/supabase-js";

let anonClient: ReturnType<typeof createClient> | null = null;

export function getAnonSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!anonClient) {
    anonClient = createClient(url, key);
  }
  return anonClient;
}
