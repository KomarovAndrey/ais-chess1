"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

interface LoginFormProps {
  resetSuccess?: boolean;
}

export default function LoginForm({ resetSuccess = false }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push("/chess");
    } catch (err) {
      setError("Не удалось выполнить вход. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-orange-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-lg backdrop-blur">
        <div className="mb-6 text-center">
          <h1 className="mb-1 text-2xl font-bold text-slate-900">
            Вход в AIS Chess
          </h1>
          <p className="text-sm text-slate-500">
            Введите школьную почту и пароль, чтобы начать игру.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-offset-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="you@school.com"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Пароль
              </label>
              <Link href="/forgot-password" className="text-xs font-medium text-blue-700 hover:underline">
                Забыли пароль?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-offset-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="Минимум 6 символов"
            />
          </div>

          {resetSuccess && (
            <div className="rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700" role="status">
              Пароль успешно изменён. Войдите с новым паролем.
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
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
            <LogIn className="h-4 w-4" />
            {loading ? "Входим..." : "Войти"}
          </Button>
        </form>

        <div className="mt-4 text-center text-xs text-slate-500">
          Нет аккаунта?{" "}
          <Link
            href="/register"
            className="font-semibold text-blue-700 underline-offset-4 hover:underline"
          >
            Зарегистрироваться
          </Link>
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-400">
          Для работы авторизации нужно настроить ключи Supabase в{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">
            .env.local
          </code>
          .
        </div>
      </div>
    </main>
  );
}
