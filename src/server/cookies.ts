import "server-only";
import { getAuthConfig } from "./config";

/**
 * Cookie layout (all HttpOnly, so no script can read a credential; none is ever mirrored into web storage):
 *
 *   hv_at   access JWT                path /          SameSite=Lax     lifetime = access TTL
 *   hv_rt   opaque refresh token      path /api/auth  SameSite=Strict  lifetime = refresh TTL (only sent to auth endpoints)
 *   hv_mfa  pending-MFA proof (JWT)   path /api/auth  SameSite=Strict  a few minutes (password OK, second factor outstanding)
 *   hv_act  activation grant          path /api/auth  SameSite=Strict  a few minutes (OTP OK, password not yet set)
 *
 * `Secure` is always on in production. Cookies are cleared with Max-Age=0 and the same attributes.
 */
export const COOKIES = {
  access: { name: "hv_at", path: "/", sameSite: "Lax" },
  refresh: { name: "hv_rt", path: "/api/auth", sameSite: "Strict" },
  mfa: { name: "hv_mfa", path: "/api/auth", sameSite: "Strict" },
  activation: { name: "hv_act", path: "/api/auth", sameSite: "Strict" },
} as const;

type Kind = keyof typeof COOKIES;

export function setCookie(kind: Kind, value: string, maxAgeSeconds: number): string {
  const c = COOKIES[kind];
  const parts = [`${c.name}=${encodeURIComponent(value)}`, `Path=${c.path}`, "HttpOnly", `SameSite=${c.sameSite}`, `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`];
  if (getAuthConfig().secureCookies) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookie(kind: Kind): string {
  return setCookie(kind, "", 0);
}

export function clearAll(): string[] {
  return (Object.keys(COOKIES) as Kind[]).map(clearCookie);
}

/** NextResponse/Response cannot hold several Set-Cookie values in a plain headers object, so append them. */
export function withCookies(response: Response, cookies: string[]): Response {
  for (const c of cookies) response.headers.append("Set-Cookie", c);
  return response;
}
