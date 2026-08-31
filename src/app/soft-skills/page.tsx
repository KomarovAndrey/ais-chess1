import type { Metadata } from "next";
import Link from "next/link";
import { SOFT_SKILLS_MODULES } from "@/lib/softSkillsModules";

export const metadata: Metadata = {
  title: "Soft Skills — AIS Chess",
  description: "Шесть модулей Soft Skills.",
};

export default function SoftSkillsPage() {
  return (
    <main className="page-bg min-h-[calc(100dvh-4.5rem)]">
      <div className="page-shell max-w-4xl">
        <h1 className="page-title text-gold">Soft Skills</h1>
        <p className="page-subtitle">Выберите модуль</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SOFT_SKILLS_MODULES.map((mod) => (
            <Link
              key={mod.id}
              href={`/soft-skills/${mod.id}`}
              className="group flex min-h-[112px] flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-gold/40 hover:bg-white/[0.07]"
            >
              <span className="font-display text-lg font-semibold text-white group-hover:text-gold">
                {mod.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
