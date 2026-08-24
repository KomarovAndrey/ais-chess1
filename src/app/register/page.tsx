"use client";

import { FormEvent, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

const LOGIN_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

type FieldErrors = {
  login?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingLogin, setCheckingLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const checkLoginAvailable = useCallback(async (value: string): Promise<boolean> => {
    const trimmed = value.trim();
    if (!LOGIN_REGEX.test(trimmed)) return false;
    setCheckingLogin(true);
    try {
      const res = await fetch(`/api/players/check?username=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      return data.available === true;
    } catch {
      return false;
    } finally {
      setCheckingLogin(false);
    }
  }, []);

  const validate = (): boolean => {
    const err: FieldErrors = {};
    const trimmedLogin = login.trim();
    if (!trimmedLogin) err.login = "Введите логин";
    else if (trimmedLogin.length < 3 || trimmedLogin.length > 30) err.login = "Длина логина от 3 до 30 символов";
    else if (!/^[a-zA-Z0-9_]+$/.test(trimmedLogin)) err.login = "Только латиница, цифры и подчёркивание";
    if (!email.trim()) err.email = "Введите адрес электронной почты";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err.email = "Введите корректный email";
    if (!password) err.password = "Придумайте пароль";
    else if (password.length < 6) err.password = "Пароль должен быть не менее 6 символов";
    if (password !== confirmPassword) err.confirmPassword = "Пароли не совпадают";
    if (!confirmPassword) err.confirmPassword = "Подтвердите пароль";
    if (!acceptTerms) err.terms = "Необходимо принять условия использования";
    if (!acceptPrivacy) err.terms = (err.terms ? err.terms + " и " : "") + "политику конфиденциальности";
    setFieldErrors(err);
    return Object.keys(err).length === 0;
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!validate()) return;

    const trimmedLogin = login.trim();
    const available = await checkLoginAvailable(trimmedLogin);
    if (!available) {
      setFieldErrors((prev) => ({ ...prev, login: "Этот логин уже занят" }));
      return;
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { username: trimmedLogin },
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/callback`
              : undefined,
        },
      });
      if (signUpError) {
        const msg = signUpError.message.toLowerCase();
        if (msg.includes("rate limit") || msg.includes("rate_limit")) {
          setError(
            "Слишком много попыток регистрации. Лимит писем от Supabase: подождите около часа или настройте лимиты в Supabase Dashboard → Authentication → Rate Limits."
          );
        } else {
          setError(signUpError.message);
        }
        return;
      }
      setSuccess(true);
      if (data?.user && !data.user.identities?.length) {
        setError("Аккаунт с таким email уже существует. Войдите или восстановите пароль.");
        setSuccess(false);
        return;
      }
    } catch (err) {
      setError("Не удалось создать аккаунт. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="page-bg flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md surface p-8 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
            <UserPlus className="h-6 w-6" />
          </div>
          <h1 className="mb-2 font-display text-xl font-semibold text-white">Регистрация отправлена</h1>
          <p className="mb-6 text-sm text-white/55">
            На адрес <strong className="text-white/85">{email}</strong> отправлено письмо с подтверждением. Перейдите по ссылке в письме, чтобы активировать аккаунт.
          </p>
          <Link href="/login" className="text-sm font-semibold text-gold hover:text-gold-bright">
            Перейти к входу
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-bg flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md surface p-8">
        <div className="mb-6 text-center">
          <h1 className="mb-1 font-display text-2xl font-semibold text-white">
            Регистрация в AIS Chess
          </h1>
          <p className="text-sm text-white/45">
            Заполните все поля. Пароль хранится в зашифрованном виде.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="login" className="text-sm font-medium text-white/70">
              Логин <span className="text-red-500">*</span>
            </label>
            <input
              id="login"
              type="text"
              autoComplete="username"
              value={login}
              onChange={(e) => {
                setLogin(e.target.value);
                setFieldErrors((prev) => ({ ...prev, login: undefined }));
              }}
              onBlur={async () => {
                const trimmed = login.trim();
                if (trimmed.length >= 3 && /^[a-zA-Z0-9_]+$/.test(trimmed) && trimmed.length <= 30) {
                  const available = await checkLoginAvailable(trimmed);
                  if (!available) setFieldErrors((prev) => ({ ...prev, login: "Этот логин уже занят" }));
                }
              }}
              className={`input-dark ${
                fieldErrors.login ? "border-red-400/70 focus:border-red-400 focus:ring-red-400/30" : ""
              }`}
              placeholder="Латиница, цифры, подчёркивание, 3–30 символов"
              aria-required
              aria-invalid={!!fieldErrors.login}
              aria-describedby={fieldErrors.login ? "login-error" : undefined}
            />
            {fieldErrors.login && (
              <p id="login-error" className="text-xs text-red-300" role="alert">{fieldErrors.login}</p>
            )}
            {checkingLogin && <p className="text-xs text-white/45">Проверка доступности...</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-white/70">
              Электронная почта <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((e) => ({ ...e, email: undefined })); }}
              className={`input-dark ${
                fieldErrors.email ? "border-red-400/70 focus:border-red-400 focus:ring-red-400/30" : ""
              }`}
              placeholder="you@school.com"
              aria-required
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
            />
            {fieldErrors.email && (
              <p id="email-error" className="text-xs text-red-300" role="alert">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-white/70">
              Пароль <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors((e) => ({ ...e, password: undefined, confirmPassword: undefined })); }}
              className={`input-dark ${
                fieldErrors.password ? "border-red-400/70 focus:border-red-400 focus:ring-red-400/30" : ""
              }`}
              placeholder="Минимум 6 символов"
              aria-required
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
            />
            {fieldErrors.password && (
              <p id="password-error" className="text-xs text-red-300" role="alert">{fieldErrors.password}</p>
            )}
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
              onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((e) => ({ ...e, confirmPassword: undefined })); }}
              className={`input-dark ${
                fieldErrors.confirmPassword ? "border-red-400/70 focus:border-red-400 focus:ring-red-400/30" : ""
              }`}
              placeholder="Повторите пароль"
              aria-required
              aria-invalid={!!fieldErrors.confirmPassword}
              aria-describedby={fieldErrors.confirmPassword ? "confirmPassword-error" : undefined}
            />
            {fieldErrors.confirmPassword && (
              <p id="confirmPassword-error" className="text-xs text-red-300" role="alert">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-start gap-3 text-sm text-white/70">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => { setAcceptTerms(e.target.checked); setFieldErrors((e) => ({ ...e, terms: undefined })); }}
                className="mt-1 h-4 w-4 rounded border-white/30 bg-white/5 text-gold focus:ring-gold"
                aria-required
                aria-invalid={!!fieldErrors.terms}
              />
              <span>Я принимаю <Link href="/terms" className="font-medium text-gold hover:text-gold-bright">условия использования</Link> <span className="text-red-500">*</span></span>
            </label>
            <label className="flex items-start gap-3 text-sm text-white/70">
              <input
                type="checkbox"
                checked={acceptPrivacy}
                onChange={(e) => { setAcceptPrivacy(e.target.checked); setFieldErrors((e) => ({ ...e, terms: undefined })); }}
                className="mt-1 h-4 w-4 rounded border-white/30 bg-white/5 text-gold focus:ring-gold"
                aria-required
                aria-invalid={!!fieldErrors.terms}
              />
              <span>Я принимаю <Link href="/privacy" className="font-medium text-gold hover:text-gold-bright">политику конфиденциальности</Link> <span className="text-red-500">*</span></span>
            </label>
            {fieldErrors.terms && (
              <p className="text-xs text-red-300" role="alert">{fieldErrors.terms}</p>
            )}
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
            <UserPlus className="h-4 w-4" />
            {loading ? "Создаём аккаунт..." : "Зарегистрироваться"}
          </Button>
        </form>

        <div className="mt-4 text-center text-xs text-white/45">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="inline-block min-h-[44px] py-2 font-semibold leading-[44px] text-gold hover:text-gold-bright">
            Войти
          </Link>
        </div>
      </div>
    </main>
  );
}
