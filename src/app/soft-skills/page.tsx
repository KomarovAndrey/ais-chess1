import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Soft Skills — AIS Chess",
  description: "Модуль Soft Skills (в разработке).",
};

export default function SoftSkillsPage() {
  return (
    <main className="page-bg min-h-[calc(100dvh-4.5rem)] px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-semibold text-white">Soft Skills</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/50">
          Раздел в разработке. Скоро здесь появится новый модуль по ТЗ.
        </p>
      </div>
    </main>
  );
}
