import { createClient } from "@/lib/supabase/server";

export type HeaderProfile = {
  username: string | null;
  display_name: string | null;
};

export type HeaderUser = {
  id: string;
  email: string | null;
};

export type HeaderAuth = {
  user: HeaderUser | null;
  profile: HeaderProfile | null;
};

/** Session for layout/header — always read from server cookies. */
export async function getHeaderAuth(): Promise<HeaderAuth> {
  const supabase = await createClient();
  if (!supabase) return { user: null, profile: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user: { id: user.id, email: user.email ?? null },
    profile: profile
      ? {
          username: profile.username ?? null,
          display_name: profile.display_name ?? null,
        }
      : null,
  };
}
