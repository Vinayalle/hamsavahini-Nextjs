import type { MetadataRoute } from "next";
import { STATIC_PATHS } from "@/content/site";
import { listSitemapEntries, loadPublic } from "@/server/services/public";

export const dynamic = "force-dynamic";

/** Every public page: the fixed pages plus the published products, articles, projects and open positions from the CMS. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const { data } = await loadPublic(() => listSitemapEntries(), []);
  const now = new Date();
  return [
    ...STATIC_PATHS.map((p) => ({ url: `${base}${p === "/" ? "" : p}`, lastModified: now, changeFrequency: "weekly" as const, priority: p === "/" ? 1 : 0.7 })),
    ...data.map((e) => ({ url: `${base}${e.path}`, lastModified: new Date(e.updated), changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
