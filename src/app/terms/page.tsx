import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="page-bg min-h-screen">
      <div className="page-shell max-w-2xl">
        <div className="surface-pad">
          <h1 className="page-title mb-4">Условия использования</h1>
          <p className="mb-4 text-sm leading-relaxed text-white/60">
            AIS Chess — школьная платформа Soft Skills и Reversi. Используя сервис, вы соглашаетесь с правилами честного поведения и этичными нормами. Запрещено передавать учётные данные третьим лицам и использовать сервис во вред другим участникам.
          </p>
          <p className="mb-6 text-sm leading-relaxed text-white/60">
            Администрация оставляет за собой право ограничить доступ при нарушении правил.
          </p>
          <Link href="/register" className="text-sm font-semibold text-gold hover:text-gold-bright">
            Вернуться к регистрации
          </Link>
        </div>
      </div>
    </main>
  );
}
