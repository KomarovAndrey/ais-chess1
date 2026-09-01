"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-bg flex min-h-[60vh] items-center justify-center px-4">
      <div className="surface max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-semibold text-white">Что-то пошло не так</h1>
        <p className="mt-2 text-sm text-white/50">
          {error.message || "Попробуйте обновить страницу."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary">
            Повторить
          </button>
          <Link href="/" className="btn-secondary">
            На главную
          </Link>
        </div>
      </div>
    </main>
  );
}
