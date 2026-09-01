import Link from "next/link";
import HomeLobbySection from "@/components/HomeLobbySection";

export const revalidate = 60;

const FEATURE_CARDS = [
  {
    href: "/soft-skills",
    title: "Soft Skills",
    description: "Модули, команды, оценки компетенций и дисциплин.",
    accent: "text-gold",
  },
  {
    href: "/ratings",
    title: "Рейтинги",
    description: "Общий за год, по модулям, командам и классам.",
    accent: "text-white",
  },
  {
    href: "/chess",
    title: "Шахматы",
    description: "Игра с компьютером, live PvP, анализ и PGN.",
    accent: "text-emerald-300",
  },
  {
    href: "/reversi",
    title: "Reversi",
    description: "Игра по ссылке с другом или против CPU локально.",
    accent: "text-sky-300",
  },
] as const;

export default function HomePage() {
  return (
    <main className="page-bg relative min-h-screen overflow-hidden">
      <section className="relative border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-br from-ink-900 via-ink-900/95 to-ink-800" />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col justify-center px-4 py-12 md:py-16">
          <div className="max-w-2xl space-y-4">
            <p className="font-display text-sm font-medium uppercase tracking-widest text-gold">
              AIS Chess
            </p>
            <h1 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl md:text-5xl">
              Школьная платформа: <span className="text-gold">Soft Skills</span> и шахматы
            </h1>
            <p className="max-w-xl text-base text-white/55">
              Оценки компетенций, рейтинги команд, live-игра и шахматы — в одном месте.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/soft-skills" className="btn-primary">
                Soft Skills
              </Link>
              <Link href="/chess" className="btn-secondary">
                Играть в шахматы
              </Link>
              <Link href="/login" className="btn-secondary">
                Войти
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="mb-4 font-display text-xl font-semibold text-white">Разделы</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="surface group block p-5 transition hover:border-gold/30"
            >
              <h3 className={`font-display text-lg font-semibold ${card.accent}`}>{card.title}</h3>
              <p className="mt-2 text-sm text-white/50 group-hover:text-white/65">{card.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <HomeLobbySection />
    </main>
  );
}
