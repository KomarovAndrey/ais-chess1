import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import { AuthProvider } from "@/components/AuthProvider";
import PresenceHeartbeat from "@/components/PresenceHeartbeat";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import { getHeaderAuth } from "@/lib/auth/session";
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
  description: "Школьная платформа: Soft Skills и Reversi",
  manifest: "/manifest.webmanifest",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0c1017",
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getHeaderAuth();

  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${unbounded.variable} font-sans page-bg min-h-screen`}>
        <AuthProvider initialUser={user} initialProfile={profile}>
          <SiteHeader initialUser={user} initialProfile={profile} />
          <PresenceHeartbeat />
          <RegisterServiceWorker />
          <div id="main-content">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}