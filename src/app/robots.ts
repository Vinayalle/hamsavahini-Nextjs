import type { MetadataRoute } from "next";

/** Search engines may crawl the public website; the admin application and the API are off limits. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }] };
}
