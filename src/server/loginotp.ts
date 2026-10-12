import "server-only";
import { randomUUID } from "node:crypto";
import { getAuthConfig } from "./config";
import { keyedDigest, randomDigits, safeEqualHex } from "./crypto";
import { getDb } from "./db";
import { ApiError } from "./errors";
import { clientIp, recordActivity } from "./audit";
import { loginCodeEmail } from "./mail-templates";
import { deliver } from "./notify";
import { enforce, LIMITS, sourceKey } from "./ratelimit";

/**
 * EMAIL CODE AS THE SECOND SIGN-IN STEP (AUTH_MFA_METHOD=email, the default).
 *
 * After a correct password, roles that require a second factor receive a 6-digit code at their registered email (nodemailer).
 * Same protections as activation codes: only a keyed HMAC digest is stored, 5-minute expiry, single use, 5 attempts (claimed
 * atomically), a resend cooldown, a new code invalidates the previous one, and the code is never logged or put in a response.
 */
const BAD_CODE = () => new ApiError(401, "invalid_code", "That code is not valid");
const digest = (challengeId: string, userId: string, code: string) => keyedDigest("login-otp", challengeId, userId, code);

export const maskEmail = (email: string) => {
  const [local, domain = ""] = email.split("@");
  return `${local.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}`;
};

/**
 * Sends a fresh code unless one was sent within the cooldown (then the previous code stays valid).
 * Throws 503 when the email cannot be sent, so an administrator is never silently locked out without an explanation.
 */
export async function sendLoginCode(request: Request, user: { id: string; name: string; email: string }): Promise<{ sent: boolean; retryAfterSeconds?: number }> {
  const cfg = getAuthConfig();
  await enforce(`login-code:acct:${user.id}`, LIMITS.loginCodeAccount);
  const code = randomDigits(6);
  const id = randomUUID();
  const db = getDb();
  const outcome = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "AdminUser" WHERE "id" = ${user.id}::uuid FOR UPDATE`; // serialise concurrent requests
    const latest = await tx.authChallenge.findFirst({ where: { userId: user.id, purpose: "login" }, orderBy: { createdAt: "desc" } });
    if (latest && Date.now() - latest.createdAt.getTime() < cfg.otpResendCooldownSeconds * 1000 && !latest.consumedAt && !latest.invalidatedAt) {
      return { created: false as const, retryAfterSeconds: Math.max(1, Math.ceil(cfg.otpResendCooldownSeconds - (Date.now() - latest.createdAt.getTime()) / 1000)) };
    }
    await tx.authChallenge.updateMany({ where: { userId: user.id, purpose: "login", consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
    await tx.authChallenge.create({ data: { id, userId: user.id, purpose: "login", codeDigest: digest(id, user.id, code), maxAttempts: cfg.otpMaxAttempts, expiresAt: new Date(Date.now() + cfg.otpTtlSeconds * 1000), ip: clientIp(request) } });
    return { created: true as const };
  });
  if (!outcome.created) return { sent: false, retryAfterSeconds: outcome.retryAfterSeconds };

  const result = await deliver("login_code", user.email, loginCodeEmail(user.name, code, Math.round(cfg.otpTtlSeconds / 60)));
  await recordActivity(db, { actorName: user.name, action: "otp_requested", entityType: "Session", entityId: user.id, entityLabel: `${user.name}: sign-in code ${result.delivered ? "emailed" : "NOT delivered"}`, ip: clientIp(request) });
  if (!result.delivered) {
    await db.authChallenge.updateMany({ where: { id }, data: { invalidatedAt: new Date() } });
    throw new ApiError(503, "email_unavailable", "We could not email your sign-in code. Try again in a moment, or ask an administrator to check the email settings.");
  }
  return { sent: true };
}

/** Checks the emailed code. Throws a generic 401 on any failure; consumes the code on success. */
export async function verifyLoginCode(request: Request, userId: string, code: string): Promise<void> {
  await enforce(`mfa:src:${sourceKey(request)}`, LIMITS.mfaSource);
  await enforce(`mfa:acct:${userId}`, LIMITS.mfaAccount);
  const db = getDb();
  const user = await db.adminUser.findUnique({ where: { id: userId }, select: { name: true, status: true } });
  const fail = async (why: string) => {
    await recordActivity(db, { actorName: user?.name ?? "Unknown", action: "mfa_failed", entityType: "Session", entityId: userId, entityLabel: "sign-in code check failed", detail: why, ip: clientIp(request) });
    throw BAD_CODE();
  };
  if (!user || user.status !== "active" || !/^\d{6}$/.test(code)) return fail("rejected");

  const challenge = await db.authChallenge.findFirst({
    where: { userId, purpose: "login", consumedAt: null, invalidatedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return fail("no active code");
  // Atomic attempt budget: concurrent guesses cannot exceed maxAttempts.
  const claimed = await db.authChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null, invalidatedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: challenge.maxAttempts } },
    data: { attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) {
    await db.authChallenge.updateMany({ where: { id: challenge.id, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
    return fail("attempts exhausted");
  }
  if (!safeEqualHex(digest(challenge.id, userId, code), challenge.codeDigest)) {
    const after = await db.authChallenge.findUniqueOrThrow({ where: { id: challenge.id }, select: { attempts: true, maxAttempts: true } });
    if (after.attempts >= after.maxAttempts) await db.authChallenge.updateMany({ where: { id: challenge.id }, data: { invalidatedAt: new Date() } });
    return fail(`wrong code (${after.attempts}/${after.maxAttempts})`);
  }
  const consumed = await db.authChallenge.updateMany({ where: { id: challenge.id, consumedAt: null, invalidatedAt: null }, data: { consumedAt: new Date() } });
  if (consumed.count !== 1) return fail("already used");
}
