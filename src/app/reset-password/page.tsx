"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setReady(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const err: { password?: string; confirm?: string } = {};
    if (!password) err.password = "Введите новый пароль";
    else if (password.length < 6) err.password = "Пароль должен быть не менее 6 символов";
    if (password !== confirmPassword) err.confirm = "Пароли не совпадают";
    if (!confirmPassword) err.confirm = "Подтвердите пароль";
    if (Object.keys(err).length > 0) {
      setFieldErrors(err);
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      router.push("/login?reset=ok");
    } catch (err) {
      setError("Не удалось обновить пароль. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <main className="page-bg flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md surface p-8 text-center">
          <p className="mb-4 text-sm text-white/55">
            Загрузка... Если вы перешли по ссылке из письма, эта страница позволит задать новый пароль.
          </p>
          <Link href="/forgot-password" className="text-sm font-semibold text-gold hover:text-gold-bright">
            Запросить ссылку снова
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md surface p-8">
        <div className="mb-6 text-center">
          <h1 className="mb-1 font-display text-2xl font-semibold text-white">
            Новый пароль
          </h1>
          <p className="text-sm text-white/45">
            Введите новый пароль и подтвердите его. Пароль хранится в зашифрованном виде.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-white/70">
              Новый пароль <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors((e) => ({ ...e, password: undefined, confirm: undefined })); }}
              className={`input-dark ${
                fieldErrors.password ? "border-red-400/70 focus:border-red-400 focus:ring-red-400/30" : ""
              }`}
              placeholder="Минимум 6 символов"
              aria-required
            />
            {fieldErrors.password && <p className="text-xs text-red-300" role="alert">{fieldErrors.password}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-white/70">
              Подтверждение пароля <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((e) => ({ ...e, confirm: undefined })); }}
              className={`input-dark ${
                fieldErrors.confirm ? "border-red-400/70 focus:border-red-400 focus:ring-red-400/30" : ""
              }`}
              placeholder="Повторите пароль"
              aria-required
            />
            {fieldErrors.confirm && <p className="text-xs text-red-300" role="alert">{fieldErrors.confirm}</p>}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300" role="alert">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="default"
            size="lg"
            className="w-full justify-center gap-2"
            disabled={loading}
          >
            <KeyRound className="h-4 w-4" />
            {loading ? "Сохраняем..." : "Сохранить пароль"}
          </Button>
        </form>

        <div className="mt-4 text-center text-xs text-white/45">
          <Link href="/login" className="inline-block min-h-[44px] py-2 font-semibold leading-[44px] text-gold hover:text-gold-bright">
            Вернуться к входу
          </Link>
        </div>
      </div>
    </main>
  );
}
