import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
// HTTPS-only directives are applied only when the site is really served over HTTPS (APP_BASE_URL=https://...), so a local
// `next start` on http://localhost keeps working.
const isHttps = (process.env.APP_BASE_URL ?? "").startsWith("https://");

/**
 * Content-Security-Policy. Next.js injects small inline scripts/styles, so those are allowed ('unsafe-inline'); everything else is
 * locked to this site: no third-party scripts, no framing, no plugins, forms/links can only post back to this origin.
 * Development additionally needs eval + websockets for hot reload. Add a source here only when the site really needs it
 * (an analytics host, a map tile server, an embedded video ...), never a wildcard.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isProd ? "" : " ws: wss:"}`,
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const baseHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS tells browsers to use HTTPS for two years, so it is sent only when the site is served over HTTPS.
  ...(isHttps ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // do not advertise the framework
  async headers() {
    // The file routes set their own, stricter headers (sandboxing CSP, caching) because they serve user-uploaded files,
    // so the generic site-wide headers must not overwrite them.
    const notMediaFile = "((?!api/media/[^/]+/file|api/public/banner-image/[^/]+).*)";
    return [
      { source: `/:path${notMediaFile}`, headers: baseHeaders },
      // The admin application and every API answer: never indexed, never cached by browsers or shared caches.
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }, { key: "Cache-Control", value: "no-store" }] },
      { source: "/api/:path((?!media/[^/]+/file|public/banner-image/[^/]+).*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
      { source: "/api/media/:id/file", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // Public website pictures set their own sandboxing CSP and public caching.
      { source: "/api/public/banner-image/:id", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

export default nextConfig;
