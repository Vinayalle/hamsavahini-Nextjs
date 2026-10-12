import "server-only";
import { randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { getAuthConfig } from "./config";

/**
 * SIGNED TOKENS (JWT, HS256 with a 256-bit random secret from the environment).
 *
 * Three purposes share one signer but can never be confused, because each carries a distinct `use` claim that the
 * matching verifier REQUIRES:
 *    access       short-lived proof of an authenticated session (cookie hv_at)
 *    mfa_pending  password was correct, second factor outstanding (cookie hv_mfa)
 *
 * Verification pins the algorithm (so "alg: none" / algorithm-confusion tricks fail), and requires issuer, audience,
 * expiry and the subject/session claims. A token proves WHO and WHICH SESSION only: whether the account is still active,
 * the session still exists and what the user may do is always read from the database on every request.
 */
export type TokenUse = "access" | "mfa_pending";

export type AccessClaims = { sub: string; sid: string };
export type PendingMfaClaims = { sub: string };

async function sign(use: TokenUse, claims: { sub: string } & Record<string, unknown>, ttlSeconds: number): Promise<string> {
  const c = getAuthConfig();
  return new SignJWT({ ...claims, use })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(c.issuer)
    .setAudience(c.audience)
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .setJti(randomUUID())
    .sign(c.jwtSecret);
}

async function verify(use: TokenUse, token: string): Promise<Record<string, unknown> | null> {
  try {
    const c = getAuthConfig();
    const { payload } = await jwtVerify(token, c.jwtSecret, {
      algorithms: ["HS256"],
      issuer: c.issuer,
      audience: c.audience,
      requiredClaims: ["sub", "exp", "iat", "jti", "use"],
    });
    return payload.use === use ? payload : null;
  } catch {
    return null; // bad signature, wrong alg/iss/aud, expired, malformed: all the same to the caller
  }
}

export const signAccessToken = (claims: AccessClaims) => sign("access", claims, getAuthConfig().accessTtlSeconds);

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  const p = await verify("access", token);
  return p && typeof p.sub === "string" && typeof p.sid === "string" ? { sub: p.sub, sid: p.sid } : null;
}

export const signPendingMfaToken = (claims: PendingMfaClaims) => sign("mfa_pending", claims, getAuthConfig().mfaPendingTtlSeconds);

export async function verifyPendingMfaToken(token: string): Promise<PendingMfaClaims | null> {
  const p = await verify("mfa_pending", token);
  return p && typeof p.sub === "string" ? { sub: p.sub } : null;
}
