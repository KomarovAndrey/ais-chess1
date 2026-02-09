"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/**
 * Страница, на которую Supabase перенаправляет после перехода по ссылке из письма (подтверждение email).
 * Обрабатывает и ?code= (PKCE), и #access_token=... (hash).
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      const code = searchParams.get("code");
      const next = searchParams.get("next") ?? "/";

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (!error) {
          setStatus("ok");
          router.replace(next);
          return;
        }
      }

      if (typeof window !== "undefined" && window.location.hash) {
        const hash = window.location.hash.slice(1);
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          const { error: setError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (cancelled) return;
          if (!setError) {
            setStatus("ok");
            router.replace(next);
            return;
          }
        }
      }

      setStatus("error");
      router.replace("/login?error=confirm");
    }

    handleCallback();
    return () => { cancelled = true; };
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-orange-50">
      <div className="text-center">
        {status === "loading" && (
          <p className="text-slate-600">Подтверждение аккаунта...</p>
        )}
        {status === "ok" && (
          <p className="text-slate-600">Вход выполнен, перенаправление...</p>
        )}
        {status === "error" && (
          <p className="text-slate-600">Перенаправление на страницу входа...</p>
        )}
      </div>
    </main>
  );
}
