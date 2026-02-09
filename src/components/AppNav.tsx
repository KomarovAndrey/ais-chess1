"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

export default function AppNav() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <nav className="hidden gap-4 text-sm font-medium text-slate-600 md:flex">
        <span className="animate-pulse">...</span>
      </nav>
    );
  }

  if (user) {
    return (
      <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
        <Link href="/profile" className="hover:text-blue-700">
          Профиль
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="hover:text-blue-700"
        >
          Выйти
        </button>
      </nav>
    );
  }

  return (
    <nav className="hidden gap-4 text-sm font-medium text-slate-600 md:flex">
      <Link href="/login" className="hover:text-blue-700">
        Войти
      </Link>
      <Link href="/register" className="hover:text-blue-700">
        Регистрация
      </Link>
    </nav>
  );
}
