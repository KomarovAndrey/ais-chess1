import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Условия использования</h1>
        <p className="mb-4 text-sm text-slate-600">
          AIS Chess — внутришкольный сайт для игры в шахматы. Используя сервис, вы соглашаетесь с правилами школы и этичными нормами поведения. Запрещено передавать учётные данные третьим лицам и использовать сервис в целях, не связанных с учёбой и игрой.
        </p>
        <p className="mb-6 text-sm text-slate-600">
          Администрация оставляет за собой право ограничить доступ при нарушении правил.
        </p>
        <Link href="/register" className="text-sm font-semibold text-blue-700 underline-offset-4 hover:underline">
          Вернуться к регистрации
        </Link>
      </div>
    </main>
  );
}
