"use client";

import { useAuth } from "@/components/AuthProvider";
import SeekLobby from "@/components/SeekLobby";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export default function HomeLobbySection() {
  const router = useRouter();
  const { user } = useAuth();

  const handleAccept = useCallback(
    async (seekId: string) => {
      const res = await fetch("/api/seeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptSeekId: seekId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Не удалось принять вызов");
      if (data.gameId) router.push(`/play/${data.gameId}`);
    },
    [router]
  );

  const handleOpenSeek = useCallback(async () => {
    const res = await fetch("/api/seeks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeControlSeconds: 300,
        incrementSeconds: 0,
        rated: true,
        color: "random",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Не удалось создать вызов");
    if (data.gameId) router.push(`/play/${data.gameId}`);
  }, [router]);

  return (
    <SeekLobby
      userId={user?.id ?? null}
      onAccept={handleAccept}
      onOpenSeek={() => void handleOpenSeek()}
    />
  );
}
