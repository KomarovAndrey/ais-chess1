"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const INTERVAL_MS = 45_000;

/** Keeps last_seen_at fresh; sets current_game_id on /reversi/play/[id]. */
export default function PresenceHeartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function beat() {
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session?.user) return;

      const playMatch = pathname?.match(/^\/reversi\/play\/([0-9a-f-]{36})/i);
      const gameId = playMatch?.[1] ?? null;

      await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      }).catch(() => undefined);
    }

    void beat();
    timer = setInterval(() => void beat(), INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [pathname]);

  return null;
}
