import type { MetadataRoute } from "next";

/** Search engines may crawl the public website; the admin application and the API are off limits. */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }], sitemap: `${base}/sitemap.xml` };
}
