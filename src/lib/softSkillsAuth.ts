import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isStaffRole, resolveUserRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export async function requireStaffAuth(): Promise<
  | { supabase: SupabaseClient; user: User; admin: SupabaseClient | null }
  | { response: NextResponse }
> {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth;

  const { supabase, user } = auth;
  const { data: row } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = await resolveUserRole(supabase, user.id, row?.role ?? null);
  if (!isStaffRole(role)) {
    return {
      response: NextResponse.json({ error: "Access denied" }, { status: 403 }),
    };
  }

  return { supabase, user, admin: createAdminClient() };
}
