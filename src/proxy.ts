import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * SERVER-SIDE PAGE GATE (database mode only).
 *
 * Runs before every /admin page request, both full page loads and client-side navigations, and asks the
 * API (which checks the session cookie and the employee's CURRENT permissions in PostgreSQL) whether this
 * page may be opened. This is what blocks a direct URL for a revoked page; hiding sidebar links is only cosmetic.
 *
 * The decision itself is made by /api/auth/page-access, so there is exactly one implementation of the rules
 * (src/lib/authz). The proxy fails CLOSED: if that check cannot be completed, the page is not served.
 *
 * It is only an initial NAVIGATION gate. When the short-lived access token has expired, the visitor is sent to the login
 * page, which silently tries POST /api/auth/refresh (the refresh cookie is scoped to /api/auth, so only that endpoint sees it)
 * and returns them to the page. Every API route re-authorizes on its own.
 */

/** Pages reachable without a session. */
const PUBLIC = [/^\/admin\/login$/, /^\/admin\/activate$/, /^\/admin\/forgot-password$/, /^\/admin\/reset-password$/];

export async function proxy(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_DATA_SOURCE !== "api") return NextResponse.next(); // mock mode: no backend

  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  let decision: { allowed: boolean; reason: string };
  try {
    const res = await fetch(new URL(`/api/auth/page-access?path=${encodeURIComponent(pathname)}`, request.url), {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`page-access ${res.status}`);
    decision = await res.json();
  } catch {
    return new NextResponse("Service temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  if (decision.allowed) return NextResponse.next();

  if (decision.reason === "unauthenticated") {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  const denied = new URL("/admin/access-denied", request.url);
  denied.searchParams.set("from", pathname);
  return NextResponse.redirect(denied);
}

export const config = {
  // Admin pages only. API routes enforce their own authorization; static assets are excluded.
  matcher: ["/admin/:path*"],
};
