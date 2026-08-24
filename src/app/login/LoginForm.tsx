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
      router.push("/");
      router.refresh();
    } catch (err) {
      setError("Не удалось выполнить вход. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="surface w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="page-title text-2xl">Вход в AIS Chess</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="label-dark">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-dark"
              placeholder="you@school.com"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="label-dark">Пароль</label>
              <Link href="/forgot-password" className="text-xs font-medium text-gold hover:text-gold-bright">
                Забыли пароль?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-dark"
              placeholder="Минимум 6 символов"
            />
          </div>

          {resetSuccess && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300" role="status">
              Пароль успешно изменён. Войдите с новым паролем.
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <Button type="submit" variant="default" size="lg" className="w-full justify-center gap-2" disabled={loading}>
            <LogIn className="h-4 w-4" />
            {loading ? "Входим..." : "Войти"}
          </Button>
        </form>

        <div className="mt-4 text-center text-xs text-white/45">
          Нет аккаунта?{" "}
          <Link href="/register" className="font-semibold text-gold hover:text-gold-bright">
            Зарегистрироваться
          </Link>
        </div>
      </div>
    </main>
  );
}
