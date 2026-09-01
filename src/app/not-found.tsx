import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-bg flex min-h-[60vh] items-center justify-center px-4">
      <div className="surface max-w-md p-8 text-center">
        <p className="font-display text-5xl font-semibold text-gold">404</p>
        <h1 className="mt-2 font-display text-xl font-semibold text-white">Страница не найдена</h1>
        <p className="mt-2 text-sm text-white/50">Проверьте адрес или вернитесь на главную.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary">
            Главная
          </Link>
          <Link href="/chess" className="btn-secondary">
            Шахматы
          </Link>
          <Link href="/soft-skills" className="btn-secondary">
            Soft Skills
          </Link>
        </div>
      </div>
    </main>
  );
}
