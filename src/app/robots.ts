import type { MetadataRoute } from "next";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://ais-chess.example.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/forgot-password",
          "/reset-password",
          "/login",
          "/register",
          "/profile",
          "/play/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
