import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="page-bg min-h-screen">
      <div className="page-shell max-w-2xl">
        <div className="surface-pad">
          <h1 className="page-title mb-4">Политика конфиденциальности</h1>
          <p className="mb-4 text-sm leading-relaxed text-white/60">
            Мы храним только необходимые данные для работы аккаунта: email, имя пользователя и зашифрованный пароль (хеш). Пароли не хранятся в открытом виде. Данные обрабатываются через Supabase и не передаются третьим лицам в рекламных целях.
          </p>
          <p className="mb-6 text-sm leading-relaxed text-white/60">
            Для восстановления пароля мы отправляем письмо на указанный email. Подтверждение регистрации также выполняется по ссылке из письма.
          </p>
          <Link href="/register" className="text-sm font-semibold text-gold hover:text-gold-bright">
            Вернуться к регистрации
          </Link>
        </div>
      </div>
    </main>
  );
}
