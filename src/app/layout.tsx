import type { Metadata } from "next";
import { Manrope, Unbounded } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import PresenceHeartbeat from "@/components/PresenceHeartbeat";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap"
});

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
  display: "swap"
});

export const metadata: Metadata = {
  title: "AIS Chess",
  description: "Онлайн-шахматы: партии, рейтинг, задачи и турниры",
  manifest: "/manifest.webmanifest",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5
  },
  themeColor: "#0c1017",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AIS Chess",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon-192.svg" }],
  },
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${unbounded.variable} font-sans page-bg min-h-screen`}>
        <SiteHeader />
        <PresenceHeartbeat />
        <RegisterServiceWorker />
        {children}
        <footer className="border-t border-white/5 py-8 text-center">
          <a
            href="https://ais.alabuga.ru/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/45 transition hover:text-gold"
          >
            Международная школа «Алабуга»
          </a>
        </footer>
      </body>
    </html>
  );
}
