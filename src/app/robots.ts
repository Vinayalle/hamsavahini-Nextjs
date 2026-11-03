import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/site-url";

/** Search engines may crawl the public website; the admin application and the API are off limits. */
export default function robots(): MetadataRoute.Robots {
  const base = siteBaseUrl();
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }], sitemap: `${base}/sitemap.xml` };
}
