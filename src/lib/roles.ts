import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type UserRole = "student" | "teacher" | "admin";

export function isStaffRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "teacher";
}

export async function resolveUserRole(
  supabase: SupabaseClient,
  userId: string,
  rowRole?: string | null
): Promise<UserRole> {
  if (rowRole === "admin" || rowRole === "teacher" || rowRole === "student") {
    return rowRole;
  }

  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    const r = (data as { role?: string } | null)?.role;
    if (r === "admin" || r === "teacher" || r === "student") return r;
  }

  const { data: self } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const selfRole = (self as { role?: string } | null)?.role;
  if (selfRole === "admin" || selfRole === "teacher" || selfRole === "student") {
    return selfRole;
  }

  return "student";
}
