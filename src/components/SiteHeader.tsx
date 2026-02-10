"use client";

import Link from "next/link";
import AppNav from "@/components/AppNav";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="flex items-center rounded-lg border border-slate-300 px-2 py-1.5 font-semibold text-slate-900 transition hover:bg-slate-100 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="На главную"
          >
            <span className="text-lg font-bold tracking-tight">AIS Chess</span>
          </Link>
          <Link
            href="/soft-skills"
            className="flex items-center rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-900 transition hover:bg-slate-100 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <span className="text-lg font-bold tracking-tight">Soft Skills</span>
          </Link>
          <Link
            href="/ratings"
            className="flex items-center rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-900 transition hover:bg-slate-100 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <span className="text-lg font-bold tracking-tight">Рейтинги</span>
          </Link>
        </div>
        <AppNav />
      </div>
    </header>
  );
}
