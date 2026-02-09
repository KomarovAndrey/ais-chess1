import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AuthResult =
  | { supabase: SupabaseClient; user: User }
  | { response: NextResponse };

/**
 * Get Supabase server client with user session for API routes.
 * Returns 401 if not configured or user is not authenticated.
 */
export async function getSupabaseAndUser(): Promise<AuthResult> {
  const supabase = await createClient();
  if (!supabase) {
    return {
      response: NextResponse.json(
        {
          error:
            "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
        },
        { status: 500 }
      )
    };
  }

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      response: NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      )
    };
  }

  return { supabase, user };
}

export type OptionalAuthResult =
  | { supabase: SupabaseClient; user: User }
  | { supabase: SupabaseClient; user: null };

/**
 * Get Supabase server client; user may be null (guest).
 * Use for routes that allow play without registration.
 */
export async function getSupabaseOptionalUser(): Promise<
  OptionalAuthResult | { response: NextResponse }
> {
  const supabase = await createClient();
  if (!supabase) {
    return {
      response: NextResponse.json(
        {
          error:
            "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
        },
        { status: 500 }
      )
    };
  }

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError) {
    return { supabase, user: null };
  }

  return { supabase, user: user ?? null };
}
