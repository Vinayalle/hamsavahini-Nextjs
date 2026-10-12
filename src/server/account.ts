import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { passwordProblem } from "@/lib/authz/password-policy";
import { getAuthConfig } from "./config";
import { clearCookie, setCookie, COOKIES } from "./cookies";
import { keyedDigest, randomDigits, safeEqualHex } from "./crypto";
import { getDb } from "./db";
import { recordActivity, clientIp } from "./audit";
import { ApiError, errors } from "./errors";
import { appBaseUrl } from "./mail";
import { invitationEmail, otpEmail, passwordResetEmail } from "./mail-templates";
import { deferDelivery, deliver, sendSecurityNotice } from "./notify";
import { enforce, LIMITS, sourceKey } from "./ratelimit";
import { hashPassword, hashToken, newToken, readCookie, verifyPassword } from "./security";
import { revokeUserSessions, type AuthSession } from "./auth";
import { recordAccessChange } from "./authz/history";

type Db = PrismaClient | Prisma.TransactionClient;
type TokenType = "invite" | "password_reset" | "activation_grant";

const RESET_TTL_SECONDS = 60 * 60;
const emailKey = (email: string) => keyedDigest("rl-email", email).slice(0, 32);
const normEmail = (e: string) => e.trim().toLowerCase();

/** Creates a single-use token (replacing any unused one of the same type). Only the SHA-256 is stored. */
export async function issueUserToken(db: Db, userId: string, type: TokenType): Promise<string> {
  const cfg = getAuthConfig();
  const ttl = type === "invite" ? cfg.inviteTtlSeconds : type === "password_reset" ? RESET_TTL_SECONDS : cfg.activationGrantTtlSeconds;
  const raw = newToken();
  await db.userToken.deleteMany({ where: { userId, type, usedAt: null } });
  await db.userToken.create({ data: { userId, type, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + ttl * 1000) } });
  return raw;
}

/* ───────────────────────── invitation ───────────────────────── */

export interface InviteResult {
  /** True only if the mailer reports it actually delivered the email. */
  deliveredByEmail: boolean;
  /**
   * Present ONLY when email could not be delivered, so the authorised administrator can pass the link on.
   * For an invitation this is the public activation page (it contains no secret: the employee must still receive
   * a one-time code at their registered mailbox). For an admin-sent reset it is a single-use expiring link.
   */
  inviteUrl?: string;
  expiresAt: string;
}

/**
 * Invitation = the account exists in `invited` status and holds an open, expiring invitation marker. The email carries NO
 * secret: the employee proves mailbox ownership with a one-time code later. Re-inviting refreshes the marker.
 * An admin-initiated password reset for an active account sends a normal reset link.
 */
export async function sendAccountLink(
  request: Request,
  session: AuthSession | null,
  user: { id: string; email: string; name: string },
  type: "invite" | "password_reset",
): Promise<InviteResult> {
  const db = getDb();
  const cfg = getAuthConfig();
  const raw = await issueUserToken(db, user.id, type);
  const base = appBaseUrl(request);
  const url = type === "invite" ? `${base}/admin/activate?email=${encodeURIComponent(user.email)}` : `${base}/admin/reset-password?token=${encodeURIComponent(raw)}`;
  const message = type === "invite" ? invitationEmail(user.name, url, Math.round(cfg.inviteTtlSeconds / 86400)) : passwordResetEmail(user.name, url, RESET_TTL_SECONDS / 60);
  const result = await deliver(type === "invite" ? "admin_invite" : "password_reset", user.email, message);
  await recordActivity(db, {
    session, actorName: session ? undefined : user.email, action: type === "invite" ? "invited" : "password_reset",
    entityType: "Admin user", entityId: user.id, entityLabel: user.name, detail: result.delivered ? "emailed" : "email not delivered", ip: clientIp(request),
  });
  const expiresAt = new Date(Date.now() + (type === "invite" ? cfg.inviteTtlSeconds : RESET_TTL_SECONDS) * 1000).toISOString();
  return result.delivered ? { deliveredByEmail: true, expiresAt } : { deliveredByEmail: false, inviteUrl: url, expiresAt };
}

/* ───────────────────────── first-time activation: email OTP ───────────────────────── */

const OTP_GENERIC_FAIL = () => errors.invalid("That code is invalid or has expired. Request a new one.", { code: "That code is invalid or has expired" });

/** An account may activate only while it is `invited`, has no password yet, and holds an unexpired invitation. */
async function activatableUser(db: Db, email: string) {
  const user = await db.adminUser.findUnique({ where: { email }, select: { id: true, name: true, email: true, status: true, passwordHash: true } });
  if (!user || user.status !== "invited" || user.passwordHash) return null;
  const open = await db.userToken.findFirst({ where: { userId: user.id, type: "invite", usedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } });
  return open ? user : null;
}

const otpDigest = (challengeId: string, userId: string, code: string) => keyedDigest("activation-otp", challengeId, userId, code);

/** Public. Always answers the same way (no account enumeration), whether or not an email was sent. */
export async function requestActivationOtp(request: Request, emailInput: string): Promise<void> {
  const email = normEmail(emailInput);
  await enforce(`otp-req:src:${sourceKey(request)}`, LIMITS.otpRequestSource);
  await enforce(`otp-req:acct:${emailKey(email)}`, LIMITS.otpRequestAccount);
  const db = getDb();
  const cfg = getAuthConfig();
  const user = await activatableUser(db, email);
  if (!user) return;

  const code = randomDigits(6);
  const id = randomUUID();
  const created = await db.$transaction(async (tx) => {
    // Serialise concurrent requests for the same account: cooldown check + invalidate + insert are one atomic step.
    await tx.$queryRaw`SELECT "id" FROM "AdminUser" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
    const latest = await tx.authChallenge.findFirst({ where: { userId: user.id, purpose: "activation" }, orderBy: { createdAt: "desc" } });
    if (latest && Date.now() - latest.createdAt.getTime() < cfg.otpResendCooldownSeconds * 1000) return false;
    await tx.authChallenge.updateMany({ where: { userId: user.id, purpose: "activation", consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
    await tx.authChallenge.create({
      data: { id, userId: user.id, purpose: "activation", codeDigest: otpDigest(id, user.id, code), maxAttempts: cfg.otpMaxAttempts, expiresAt: new Date(Date.now() + cfg.otpTtlSeconds * 1000), ip: clientIp(request) },
    });
    return true;
  });
  if (!created) return; // inside the resend cooldown: the previous code is still valid
  const ip = clientIp(request);
  await deferDelivery(async () => {
    const result = await deliver("activation_otp", user.email, otpEmail(user.name, code, Math.round(cfg.otpTtlSeconds / 60)));
    await recordActivity(db, { actorName: user.name, action: "otp_requested", entityType: "Admin user", entityId: user.id, entityLabel: user.name, detail: result.delivered ? "code emailed" : "email not delivered", ip });
  });
}

/** Public. A correct code is consumed exactly once and yields a short-lived single-use activation grant (HttpOnly cookie). */
export async function verifyActivationOtp(request: Request, emailInput: string, code: string): Promise<string[]> {
  const email = normEmail(emailInput);
  await enforce(`otp-ver:src:${sourceKey(request)}`, LIMITS.otpVerifySource);
  await enforce(`otp-ver:acct:${emailKey(email)}`, LIMITS.otpVerifyAccount);
  const db = getDb();
  const cfg = getAuthConfig();
  const user = await activatableUser(db, email);
  if (!user) throw OTP_GENERIC_FAIL();

  const challenge = await db.authChallenge.findFirst({
    where: { userId: user.id, purpose: "activation", consumedAt: null, invalidatedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) throw OTP_GENERIC_FAIL();

  // Atomic attempt budget: concurrent guesses cannot exceed maxAttempts.
  const claimed = await db.authChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null, invalidatedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: challenge.maxAttempts } },
    data: { attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) {
    await db.authChallenge.updateMany({ where: { id: challenge.id, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
    throw OTP_GENERIC_FAIL();
  }
  if (!safeEqualHex(otpDigest(challenge.id, user.id, code), challenge.codeDigest)) {
    const after = await db.authChallenge.findUniqueOrThrow({ where: { id: challenge.id }, select: { attempts: true, maxAttempts: true } });
    if (after.attempts >= after.maxAttempts) await db.authChallenge.updateMany({ where: { id: challenge.id }, data: { invalidatedAt: new Date() } });
    await recordActivity(db, { actorName: user.name, action: "otp_failed", entityType: "Admin user", entityId: user.id, entityLabel: user.name, detail: `wrong code (${after.attempts}/${after.maxAttempts})`, ip: clientIp(request) });
    throw OTP_GENERIC_FAIL();
  }

  const grant = await db.$transaction(async (tx) => {
    const consumed = await tx.authChallenge.updateMany({ where: { id: challenge.id, consumedAt: null, invalidatedAt: null }, data: { consumedAt: new Date() } });
    if (consumed.count !== 1) throw OTP_GENERIC_FAIL(); // a concurrent request used it first
    const raw = await issueUserToken(tx, user.id, "activation_grant");
    await recordActivity(tx, { actorName: user.name, action: "otp_verified", entityType: "Admin user", entityId: user.id, entityLabel: user.name, detail: "email verified", ip: clientIp(request) });
    return raw;
  });
  return [setCookie("activation", grant, cfg.activationGrantTtlSeconds)];
}

/** Public. Creates the first password using the activation grant. Does NOT sign the user in. */
export async function setActivationPassword(request: Request, password: string): Promise<string[]> {
  await enforce(`grant:src:${sourceKey(request)}`, LIMITS.grantSource);
  const raw = readCookie(request.headers.get("cookie"), COOKIES.activation.name);
  const expired = () => new ApiError(401, "activation_expired", "Your verification expired. Request a new code.");
  if (!raw) throw expired();
  const db = getDb();
  const user = await db.$transaction(async (tx) => {
    const grant = await tx.userToken.findUnique({ where: { tokenHash: hashToken(raw) }, include: { user: true } });
    if (!grant || grant.type !== "activation_grant" || grant.usedAt || grant.expiresAt < new Date()) throw expired();
    const u = grant.user;
    if (u.status !== "invited" || u.passwordHash) throw expired();
    const invite = await tx.userToken.findFirst({ where: { userId: u.id, type: "invite", usedAt: null, expiresAt: { gt: new Date() } } });
    if (!invite) throw expired();
    // Policy first: a rejected password rolls everything back, so the grant stays usable for another try.
    const problem = passwordProblem(password, { name: u.name, email: u.email, extraTerms: [u.employeeId] });
    if (problem) throw errors.invalid(problem, { password: problem });
    const claimed = await tx.userToken.updateMany({ where: { id: grant.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw expired();
    await tx.adminUser.update({
      where: { id: u.id },
      data: { passwordHash: await hashPassword(password), status: "active", emailVerifiedAt: new Date(), passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    });
    await tx.userToken.updateMany({ where: { userId: u.id, type: "invite", usedAt: null }, data: { usedAt: new Date() } });
    await recordActivity(tx, { actorName: u.name, action: "account_activated", entityType: "Admin user", entityId: u.id, entityLabel: u.name, detail: "email verified, password created", ip: clientIp(request) });
    await recordAccessChange(tx, { session: null, actorName: u.name, targetType: "user", targetId: u.id, targetLabel: u.name, kind: "status_changed", change: { from: "invited", to: "active", via: "activation" } });
    return u;
  });
  await deferDelivery(() => sendSecurityNotice(user, "account_activated"));
  return [clearCookie("activation")];
}

/* ───────────────────────── password reset (separate from activation) ───────────────────────── */

/** Public: always succeeds from the caller's perspective (no account enumeration). */
export async function requestPasswordReset(request: Request, emailInput: string): Promise<void> {
  const email = normEmail(emailInput);
  await enforce(`forgot:src:${sourceKey(request)}`, LIMITS.forgotSource);
  await enforce(`forgot:acct:${emailKey(email)}`, LIMITS.forgotAccount);
  const db = getDb();
  const user = await db.adminUser.findUnique({ where: { email } });
  if (!user || user.status !== "active" || !user.passwordHash) return; // silently nothing: same response either way
  const raw = await issueUserToken(db, user.id, "password_reset");
  const url = `${appBaseUrl(request)}/admin/reset-password?token=${encodeURIComponent(raw)}`;
  const ip = clientIp(request);
  await deferDelivery(async () => {
    const result = await deliver("password_reset", user.email, passwordResetEmail(user.name, url, RESET_TTL_SECONDS / 60));
    await recordActivity(db, { actorName: user.name, action: "password_reset", entityType: "Admin user", entityId: user.id, entityLabel: user.name, detail: result.delivered ? "reset link emailed" : "reset link not delivered", ip });
  });
}

/** Public: complete a reset. Revokes every session and refresh token of the account. */
export async function resetPassword(request: Request, token: string, password: string): Promise<void> {
  await enforce(`reset:src:${sourceKey(request)}`, LIMITS.resetSource);
  const db = getDb();
  const invalid = () => errors.invalid("This link is invalid or has expired", { token: "This link is invalid or has expired" });
  const user = await db.$transaction(async (tx) => {
    const row = await tx.userToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    // One generic message for every failure mode (unknown / used / expired / wrong type, including activation grants).
    if (!row || row.type !== "password_reset" || row.usedAt || row.expiresAt < new Date() || row.user.status !== "active") throw invalid();
    const u = row.user;
    const problem = passwordProblem(password, { email: u.email, name: u.name, extraTerms: [u.employeeId] });
    if (problem) throw errors.invalid(problem, { password: problem });
    if (u.passwordHash && (await verifyPassword(u.passwordHash, password))) throw errors.invalid("Choose a password you have not used before", { password: "Choose a password you have not used before" });
    const claimed = await tx.userToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw invalid();
    await tx.adminUser.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } });
    await tx.userToken.deleteMany({ where: { userId: u.id, type: "password_reset", usedAt: null } });
    await revokeUserSessions(tx, u.id);
    await recordActivity(tx, { actorName: u.name, action: "password_reset", entityType: "Admin user", entityId: u.id, entityLabel: u.name, detail: "password reset completed; all sessions revoked", ip: clientIp(request) });
    return u;
  });
  await deferDelivery(() => sendSecurityNotice(user, "password_reset_done"));
}

/** Authenticated: change own password. Requires the current one; ends all OTHER sessions. */
export async function changeOwnPassword(request: Request, session: AuthSession, current: string, next: string): Promise<void> {
  await enforce(`chgpw:acct:${session.user.id}`, LIMITS.changePasswordAccount);
  const db = getDb();
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, current))) throw errors.invalid("Current password is incorrect", { current: "Current password is incorrect" });
  if (current === next) throw errors.invalid("New password must differ from the current one", { next: "New password must differ from the current one" });
  const problem = passwordProblem(next, { email: user.email, name: user.name, extraTerms: [user.employeeId] });
  if (problem) throw errors.invalid(problem, { next: problem });
  await db.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next), passwordChangedAt: new Date() } });
    await revokeUserSessions(tx, user.id, session.sessionId);
    await recordActivity(tx, { session, action: "updated", entityType: "Admin user", entityId: user.id, entityLabel: user.name, detail: "password changed; other sessions revoked", ip: clientIp(request) });
  });
  await deferDelivery(() => sendSecurityNotice(user, "password_changed"));
}
