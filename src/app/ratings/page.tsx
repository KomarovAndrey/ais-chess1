import { redirect } from "next/navigation";
import SoftSkillsRatingsSection from "@/components/soft-skills/SoftSkillsRatingsSection";

export const dynamic = "force-dynamic";

export default async function RatingsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    type?: string;
    section?: string;
    league?: string;
    view?: string;
    module?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};

  if (sp.section === "chess" || sp.type) {
    redirect("/ratings?view=overall");
  }

  return (
    <SoftSkillsRatingsSection
      searchParams={{
        view: sp.view,
        module: sp.module,
        league: sp.league,
      }}
    />
  );
}
