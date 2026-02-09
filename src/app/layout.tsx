import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "AIS Chess",
  description: "Внутришкольный сайт для игры в шахматы AIS Chess"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <SiteHeader />
        {children}
        <footer className="py-6 text-center">
          <a
            href="https://ais.alabuga.ru/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 hover:text-blue-700 underline-offset-4 hover:underline text-sm"
          >
            Международная школа «Алабуга»
          </a>
        </footer>
      </body>
    </html>
  );
}

