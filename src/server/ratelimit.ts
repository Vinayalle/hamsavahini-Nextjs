import "server-only";
import { getDb } from "./db";
import { errors } from "./errors";
import { getAuthConfig } from "./config";

/**
 * DATABASE-BACKED RATE LIMITING (shared by every app instance).
 *
 * A single atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` increments (or restarts) a fixed-window counter,
 * so concurrent requests cannot read the same value and both slip under the limit.
 *
 * Keys are namespaced "<scope>:<subject>" and hashed-by-construction by callers where the subject is an email.
 * Failure to reach the database fails CLOSED (the request is refused), never open.
 */
export interface Limit {
  /** Requests allowed per window. */
  max: number;
  windowSeconds: number;
}

export interface Hit {
  count: number;
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function hit(key: string, limit: Limit): Promise<Hit> {
  const rows = await getDb().$queryRaw<{ count: number; retry: number }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count")
    VALUES (${key}, now(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" <= now() - make_interval(secs => ${limit.windowSeconds}::double precision) THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" <= now() - make_interval(secs => ${limit.windowSeconds}::double precision) THEN now() ELSE "RateLimit"."windowStart" END
    RETURNING "count", CEIL(EXTRACT(EPOCH FROM ("windowStart" + make_interval(secs => ${limit.windowSeconds}::double precision) - now())))::int AS retry`;
  const { count, retry } = rows[0];
  return { count, allowed: count <= limit.max, retryAfterSeconds: Math.max(1, retry) };
}

/** Throws a generic 429 (with Retry-After) when the limit is exceeded. */
export async function enforce(key: string, limit: Limit): Promise<void> {
  const r = await hit(key, limit);
  if (!r.allowed) throw errors.tooMany(r.retryAfterSeconds);
}

/** Forget a counter (e.g. after a successful login). */
export async function clear(key: string): Promise<void> {
  await getDb().rateLimit.deleteMany({ where: { key } });
}

/**
 * The client address used for per-source limits. X-Forwarded-For is attacker-controlled unless a trusted reverse proxy
 * overwrites it, so it is only honoured when AUTH_TRUST_PROXY=true. Otherwise every request shares the "direct" bucket,
 * which is why source limits are deliberately generous and per-ACCOUNT limits do the real protection.
 */
export function sourceKey(request: Request): string {
  if (!getAuthConfig().trustProxy) return "direct";
  const fwd = request.headers.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",").pop() : request.headers.get("x-real-ip"))?.trim();
  return ip && ip.length <= 64 ? ip : "direct";
}

/** Policy table: every limit in one reviewable place. */
export const LIMITS = {
  loginAccount: { max: 8, windowSeconds: 15 * 60 },
  loginSource: { max: 60, windowSeconds: 15 * 60 },
  otpRequestAccount: { max: 5, windowSeconds: 60 * 60 },
  otpRequestSource: { max: 30, windowSeconds: 60 * 60 },
  otpVerifyAccount: { max: 10, windowSeconds: 30 * 60 },
  otpVerifySource: { max: 60, windowSeconds: 30 * 60 },
  grantSource: { max: 30, windowSeconds: 30 * 60 },
  forgotAccount: { max: 3, windowSeconds: 60 * 60 },
  forgotSource: { max: 20, windowSeconds: 60 * 60 },
  resetSource: { max: 20, windowSeconds: 30 * 60 },
  mfaAccount: { max: 10, windowSeconds: 15 * 60 },
  mfaSource: { max: 60, windowSeconds: 15 * 60 },
  refreshSource: { max: 120, windowSeconds: 5 * 60 },
  reauthAccount: { max: 8, windowSeconds: 15 * 60 },
  changePasswordAccount: { max: 8, windowSeconds: 15 * 60 },
} as const satisfies Record<string, Limit>;
