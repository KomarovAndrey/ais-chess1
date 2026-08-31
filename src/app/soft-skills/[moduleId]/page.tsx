import Link from "next/link";
import { notFound } from "next/navigation";
import { getSoftSkillsModule, SOFT_SKILLS_MODULES } from "@/lib/softSkillsModules";

export function generateStaticParams() {
  return SOFT_SKILLS_MODULES.map((m) => ({ moduleId: m.id }));
}

export default async function SoftSkillsModulePage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = await params;
  const mod = getSoftSkillsModule(moduleId);
  if (!mod) notFound();

  return (
    <main className="page-bg min-h-[calc(100dvh-4.5rem)]">
      <div className="page-shell max-w-3xl">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gold">Soft Skills</p>
            <h1 className="page-title">{mod.label}</h1>
          </div>
          <Link href="/soft-skills" className="btn-secondary">
            Все модули
          </Link>
        </div>

        <div className="surface-pad">
          <p className="text-sm leading-relaxed text-white/55">Раздел модуля. Пока нет данных.</p>
        </div>
      </div>
    </main>
  );
}
