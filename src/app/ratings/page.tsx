import SoftSkillsRatingsSection from "@/components/soft-skills/SoftSkillsRatingsSection";

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
    const { redirect } = await import("next/navigation");
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
