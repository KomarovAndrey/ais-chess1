"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError("Введите адрес электронной почты");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFieldError("Введите корректный email");
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } catch (err) {
      setError("Не удалось отправить письмо. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-orange-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-lg backdrop-blur text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-slate-900">Проверьте почту</h1>
          <p className="mb-6 text-sm text-slate-600">
            На адрес <strong className="text-slate-800">{email}</strong> отправлена ссылка для сброса пароля. Перейдите по ней и задайте новый пароль.
          </p>
          <Link href="/login" className="text-sm font-semibold text-blue-700 underline-offset-4 hover:underline">
            Вернуться к входу
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
            Восстановление пароля
          </h1>
          <p className="text-sm text-slate-500">
            Введите email вашего аккаунта — мы отправим ссылку для сброса пароля.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Электронная почта <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldError(null); }}
              className={`w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-base outline-none ring-offset-2 focus:ring-2 ${
                fieldError ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-slate-200 focus:border-blue-500 focus:ring-blue-500"
              }`}
              placeholder="you@school.com"
              aria-required
              aria-invalid={!!fieldError}
            />
            {fieldError && <p className="text-xs text-red-600" role="alert">{fieldError}</p>}
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
            <Mail className="h-4 w-4" />
            {loading ? "Отправляем..." : "Отправить ссылку"}
          </Button>
        </form>

        <div className="mt-4 text-center text-xs text-slate-500">
          <Link href="/login" className="inline-block min-h-[44px] py-2 font-semibold leading-[44px] text-blue-700 underline-offset-4 hover:underline">
            Вернуться к входу
          </Link>
        </div>
      </div>
    </main>
  );
}
