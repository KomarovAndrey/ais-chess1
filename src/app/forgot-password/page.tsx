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
      <main className="page-bg flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md surface p-8 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="mb-2 font-display text-xl font-semibold text-white">Проверьте почту</h1>
          <p className="mb-6 text-sm text-white/55">
            На адрес <strong className="text-white/85">{email}</strong> отправлена ссылка для сброса пароля. Перейдите по ней и задайте новый пароль.
          </p>
          <Link href="/login" className="text-sm font-semibold text-gold hover:text-gold-bright">
            Вернуться к входу
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
            Восстановление пароля
          </h1>
          <p className="text-sm text-white/45">
            Введите email вашего аккаунта — мы отправим ссылку для сброса пароля.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-white/70">
              Электронная почта <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldError(null); }}
              className={`input-dark ${
                fieldError ? "border-red-400/70 focus:border-red-400 focus:ring-red-400/30" : ""
              }`}
              placeholder="you@school.com"
              aria-required
              aria-invalid={!!fieldError}
            />
            {fieldError && <p className="text-xs text-red-300" role="alert">{fieldError}</p>}
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
            <Mail className="h-4 w-4" />
            {loading ? "Отправляем..." : "Отправить ссылку"}
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
