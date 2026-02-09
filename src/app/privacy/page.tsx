import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Политика конфиденциальности</h1>
        <p className="mb-4 text-sm text-slate-600">
          Мы храним только необходимые данные для работы аккаунта: email, имя пользователя и зашифрованный пароль (хеш). Пароли не хранятся в открытом виде. Данные обрабатываются через Supabase и не передаются третьим лицам в рекламных целях.
        </p>
        <p className="mb-6 text-sm text-slate-600">
          Для восстановления пароля мы отправляем письмо на указанный email. Подтверждение регистрации также выполняется по ссылке из письма.
        </p>
        <Link href="/register" className="text-sm font-semibold text-blue-700 underline-offset-4 hover:underline">
          Вернуться к регистрации
        </Link>
      </div>
    </main>
  );
}
