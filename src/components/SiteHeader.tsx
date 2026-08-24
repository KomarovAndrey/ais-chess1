"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import AppNav from "@/components/AppNav";

const NAV_LINKS = [
  { href: "/ratings", label: "Рейтинг" },
  { href: "/puzzles", label: "Пазлы" },
  { href: "/tournaments", label: "Турниры" },
  { href: "/reversi", label: "Reversi" },
] as const;

export default function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-ink-900/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            className="group flex items-center gap-2.5 rounded-xl px-1 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            aria-label="На главную"
            onClick={() => setMobileOpen(false)}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold-dim text-sm font-bold text-ink-900 shadow-glow">
              ♞
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-white">
              AIS Chess
            </span>
          </Link>
          <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Основное меню">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/65 transition hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <AppNav />
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 md:hidden"
            aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          className="border-t border-white/10 bg-ink-900/95 px-4 py-3 md:hidden"
          aria-label="Мобильное меню"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-medium text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
