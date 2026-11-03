/**
 * The website's public address. No setting is needed: it is fixed here for the live site and falls back to localhost while developing.
 * (No imports, so next.config.ts can use it too.)
 *
 *   - APP_BASE_URL, when it is set, always wins (use it to try another address, or to run a production build on http://localhost:3000).
 *   - In production (`next start`, the hosted site) the answer is SITE_URL below.
 *   - Otherwise (`npm run dev`, tests) it is http://localhost:3000.
 *
 * Change SITE_URL if the site moves to another address, for example the www form. It must be https and have no trailing slash.
 */
export const SITE_URL = "https://hamsavahin.in";

export function siteBaseUrl(): string {
  const configured = process.env.APP_BASE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? SITE_URL : "http://localhost:3000";
}
