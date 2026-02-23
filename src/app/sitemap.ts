import type { MetadataRoute } from "next";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://ais-chess.example.com";

const staticRoutes: { path: string; changeFrequency?: "yearly" | "monthly" | "weekly" | "daily"; priority?: number }[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/chess", changeFrequency: "weekly", priority: 0.9 },
  { path: "/ratings", changeFrequency: "daily", priority: 0.9 },
  { path: "/soft-skills", changeFrequency: "weekly", priority: 0.7 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return staticRoutes.map(({ path, changeFrequency, priority }) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority: priority ?? 0.5,
  }));
}
