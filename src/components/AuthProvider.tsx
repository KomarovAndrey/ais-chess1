"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { HeaderProfile, HeaderUser } from "@/lib/auth/session";

type AuthContextValue = {
  user: HeaderUser | null;
  profile: HeaderProfile | null;
};

const AuthContext = createContext<AuthContextValue>({ user: null, profile: null });

export function AuthProvider({
  initialUser,
  initialProfile,
  children,
}: {
  initialUser: HeaderUser | null;
  initialProfile: HeaderProfile | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState<HeaderUser | null>(initialUser);
  const [profile, setProfile] = useState<HeaderProfile | null>(initialProfile);

  useEffect(() => {
    setUser(initialUser);
    setProfile(initialProfile);
  }, [initialUser, initialProfile]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        return;
      }
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? null });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
