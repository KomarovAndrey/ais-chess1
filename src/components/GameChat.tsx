"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ChatMessage = {
  id: string;
  userId: string;
  username: string;
  body: string;
  createdAt: string;
};

export default function GameChat({
  gameId,
  canSend,
}: {
  gameId: string;
  canSend: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/games/${gameId}/chat`);
    const data = await res.json().catch(() => null);
    if (Array.isArray(data?.messages)) {
      setMessages(data.messages);
    }
  }, [gameId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`chat:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_messages",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();

    const poll = setInterval(() => void load(), 8000);
    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [gameId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend || !text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось отправить");
      if (data.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === data.message.id)
            ? prev
            : [...prev, data.message]
        );
      }
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="surface flex h-64 flex-col p-3">
      <h2 className="mb-2 text-sm font-semibold text-white">Чат партии</h2>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 text-xs">
        {messages.length === 0 && (
          <p className="text-white/40">Пока нет сообщений.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="rounded-lg bg-white/[0.04] px-2 py-1.5">
            <span className="font-semibold text-gold/90">{m.username}</span>
            <span className="text-white/70">: {m.body}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {canSend ? (
        <form onSubmit={send} className="mt-2 flex gap-2">
          <input
            type="text"
            value={text}
            maxLength={280}
            onChange={(e) => setText(e.target.value)}
            placeholder="Сообщение…"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none focus:border-gold/40"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="rounded-xl bg-gold px-3 py-1.5 text-xs font-semibold text-ink-900 disabled:opacity-50"
          >
            →
          </button>
        </form>
      ) : (
        <p className="mt-2 text-[11px] text-white/40">
          Войдите, чтобы писать в чат.
        </p>
      )}
      {error && <p className="mt-1 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
