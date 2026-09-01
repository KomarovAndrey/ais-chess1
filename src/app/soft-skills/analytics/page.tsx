import { redirect } from "next/navigation";
import SoftSkillsAnalyticsClient from "@/components/soft-skills/SoftSkillsAnalyticsClient";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, resolveUserRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function SoftSkillsAnalyticsPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = await resolveUserRole(
    supabase,
    user.id,
    typeof row?.role === "string" ? row.role : null
  );

  if (!isStaffRole(role)) redirect("/soft-skills");

  return <SoftSkillsAnalyticsClient />;
}
