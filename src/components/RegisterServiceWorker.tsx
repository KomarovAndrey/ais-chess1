"use client";

import { useEffect } from "react";

/** Registers the PWA service worker (offline shell only). */
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
