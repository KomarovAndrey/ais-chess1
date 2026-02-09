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
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-orange-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-lg backdrop-blur text-center">
          <p className="mb-4 text-sm text-slate-600">
            Загрузка... Если вы перешли по ссылке из письма, эта страница позволит задать новый пароль.
          </p>
          <Link href="/forgot-password" className="text-sm font-semibold text-blue-700 underline-offset-4 hover:underline">
            Запросить ссылку снова
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-orange-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-lg backdrop-blur">
        <div className="mb-6 text-center">
          <h1 className="mb-1 text-2xl font-bold text-slate-900">
            Новый пароль
          </h1>
          <p className="text-sm text-slate-500">
            Введите новый пароль и подтвердите его. Пароль хранится в зашифрованном виде.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Новый пароль <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors((e) => ({ ...e, password: undefined, confirm: undefined })); }}
              className={`w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm outline-none ring-offset-2 focus:ring-2 ${
                fieldErrors.password ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-slate-200 focus:border-blue-500 focus:ring-blue-500"
              }`}
              placeholder="Минимум 6 символов"
              aria-required
            />
            {fieldErrors.password && <p className="text-xs text-red-600" role="alert">{fieldErrors.password}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
              Подтверждение пароля <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((e) => ({ ...e, confirm: undefined })); }}
              className={`w-full rounded-xl border bg-slate-50 px-3 py-2 text-sm outline-none ring-offset-2 focus:ring-2 ${
                fieldErrors.confirm ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-slate-200 focus:border-blue-500 focus:ring-blue-500"
              }`}
              placeholder="Повторите пароль"
              aria-required
            />
            {fieldErrors.confirm && <p className="text-xs text-red-600" role="alert">{fieldErrors.confirm}</p>}
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600" role="alert">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="secondary"
            size="lg"
            className="w-full justify-center gap-2"
            disabled={loading}
          >
            <KeyRound className="h-4 w-4" />
            {loading ? "Сохраняем..." : "Сохранить пароль"}
          </Button>
        </form>

        <div className="mt-4 text-center text-xs text-slate-500">
          <Link href="/login" className="font-semibold text-blue-700 underline-offset-4 hover:underline">
            Вернуться к входу
          </Link>
        </div>
      </div>
    </main>
  );
}
