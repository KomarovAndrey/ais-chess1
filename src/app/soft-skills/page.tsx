import type { Metadata } from "next";
import SoftSkillsHub from "@/components/soft-skills/SoftSkillsHub";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, resolveUserRole } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Soft Skills — AIS Chess",
  description: "Шесть модулей Soft Skills.",
};

export default async function SoftSkillsPage() {
  let isStaff = false;
  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: row } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const role = await resolveUserRole(supabase, user.id, row?.role ?? null);
      isStaff = isStaffRole(role);
    }
  }

  return <SoftSkillsHub isStaff={isStaff} />;
}
