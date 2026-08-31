export default function HomePage() {
  return (
    <main className="page-bg relative min-h-screen overflow-hidden">
      <section className="relative min-h-[calc(100dvh-4.5rem)]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-br from-ink-900 via-ink-900/95 to-ink-800" />
        </div>

        <div className="relative mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-6xl flex-col justify-center px-4 py-12 md:py-16">
          <div className="max-w-xl space-y-6">
            <p className="animate-fade-up font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
              AIS Chess
            </p>
            <h1 className="animate-fade-up-delay font-display text-2xl font-semibold leading-tight sm:text-3xl md:text-4xl">
              <span className="text-gold">Soft Skills</span>
            </h1>
          </div>
        </div>
      </section>
    </main>
  );
}
