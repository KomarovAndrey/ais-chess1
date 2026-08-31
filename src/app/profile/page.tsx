import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, resolveUserRole } from "@/lib/roles";
import StaffProfilePanel from "@/components/profile/StaffProfilePanel";
import StudentProfilePanel from "@/components/profile/StudentProfilePanel";

export default async function ProfilePage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("profiles")
    .select("username, display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = await resolveUserRole(
    supabase,
    user.id,
    typeof row?.role === "string" ? row.role : null
  );

  if (isStaffRole(role)) {
    return (
      <StaffProfilePanel
        profile={{
          username: row?.username ?? null,
          display_name: row?.display_name ?? "",
          role,
        }}
      />
    );
  }

  return <StudentProfilePanel />;
}
