"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, BarChart3 } from "lucide-react";
import SoftSkillsTeamEditor from "@/components/soft-skills/SoftSkillsTeamEditor";
import { SOFT_SKILLS_MODULES } from "@/lib/softSkillsModules";

type SoftSkillsHubProps = {
  isStaff: boolean;
};

export default function SoftSkillsHub({ isStaff }: SoftSkillsHubProps) {
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <main className="page-bg min-h-[calc(100dvh-4.5rem)]">
      <div className="page-shell max-w-4xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="page-title text-gold">Soft Skills</h1>
            <p className="page-subtitle">Выберите модуль</p>
          </div>
          {isStaff && (
            <div className="flex flex-wrap gap-2">
              <Link href="/soft-skills/analytics" className="btn-secondary gap-2">
                <BarChart3 className="h-4 w-4" />
                Аналитика
              </Link>
              <button
                type="button"
                onClick={() => setEditorOpen(true)}
                className="btn-secondary gap-2"
              >
                <Users className="h-4 w-4" />
                Редактор команд
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SOFT_SKILLS_MODULES.map((mod) => (
            <Link
              key={mod.id}
              href={`/soft-skills/${mod.id}`}
              className="group flex min-h-[112px] flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-gold/40 hover:bg-white/[0.07]"
            >
              <span className="font-display text-lg font-semibold text-white group-hover:text-gold">
                {mod.label}
              </span>
              <span className="mt-1 text-sm text-white/45">{mod.weeks} недель</span>
            </Link>
          ))}
        </div>
      </div>

      {isStaff && (
        <SoftSkillsTeamEditor open={editorOpen} onClose={() => setEditorOpen(false)} />
      )}
    </main>
  );
}
