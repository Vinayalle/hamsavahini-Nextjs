import "server-only";
import QRCode from "qrcode";
import { getAuthConfig } from "./config";
import { decryptSecret, encryptSecret, keyedDigest } from "./crypto";
import { getDb } from "./db";
import { ApiError, errors } from "./errors";
import { clientIp, recordActivity } from "./audit";
import { createSession, getSession, pendingMfaUser, requiresMfa, revokeUserSessions, type AuthSession, type IssuedSession } from "./auth";
import { enforce, LIMITS, sourceKey } from "./ratelimit";
import { randomBytes } from "node:crypto";
import { base32Encode, generateTotpSecret, matchTotp, otpauthUri } from "./totp";
import { deferDelivery, sendSecurityNotice } from "./notify";
import { sendLoginCode, verifyLoginCode } from "./loginotp";

/**
 * TOTP MFA.
 *  - The shared secret is stored ENCRYPTED (AES-256-GCM, key in the environment, bound to the user via AAD).
 *  - An accepted code's time-step is recorded atomically, so the same code can never be used twice (replay protection).
 *  - Recovery codes are random, shown once, stored only as keyed digests and are single use.
 *  - Every verification path is rate limited and audited; the response never says which part was wrong.
 */

const RECOVERY_COUNT = 10;
const BAD_CODE = () => new ApiError(401, "invalid_code", "That code is not valid");

/** Who is asking: a fully signed-in session, or a user who has passed the password step and is completing MFA. */
export type MfaSubject = { userId: string; session: AuthSession | null; pending: boolean };

export async function resolveSubject(request: Request): Promise<MfaSubject> {
  const session = await getSession(request);
  if (session) return { userId: session.user.id, session, pending: false };
  return { userId: await pendingMfaUser(request), session: null, pending: true };
}

/* ───────────────────────── recovery codes ───────────────────────── */

const normaliseRecovery = (input: string) => {
  const s = input.replace(/[\s-]/g, "").toUpperCase();
  return s.length === 10 ? `${s.slice(0, 5)}-${s.slice(5)}` : s;
};
const recoveryDigest = (userId: string, code: string) => keyedDigest("mfa-recovery", userId, normaliseRecovery(code));

function newRecoveryCode(): string {
  const raw = base32Encode(randomBytes(7)).slice(0, 10); // 50 bits of entropy
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

async function replaceRecoveryCodes(tx: Parameters<Parameters<ReturnType<typeof getDb>["$transaction"]>[0]>[0], userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_COUNT }, newRecoveryCode);
  await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
  await tx.mfaRecoveryCode.createMany({ data: codes.map((c) => ({ userId, codeDigest: recoveryDigest(userId, c) })) });
  return codes;
}

/* ───────────────────────── verification ───────────────────────── */

async function claimStep(userId: string, step: number): Promise<boolean> {
  const r = await getDb().$executeRaw`UPDATE "MfaCredential" SET "lastUsedStep" = ${step} WHERE "userId" = ${userId}::uuid AND "enabledAt" IS NOT NULL AND ("lastUsedStep" IS NULL OR "lastUsedStep" < ${step})`;
  return r === 1;
}

/** Checks a TOTP or recovery code for an ENROLLED user. Throws a generic 401 on any failure. */
export async function verifyMfaInput(request: Request, userId: string, input: { code?: string; recoveryCode?: string }): Promise<"totp" | "recovery"> {
  await enforce(`mfa:src:${sourceKey(request)}`, LIMITS.mfaSource);
  await enforce(`mfa:acct:${userId}`, LIMITS.mfaAccount);
  const db = getDb();
  const user = await db.adminUser.findUnique({ where: { id: userId }, select: { name: true, status: true, mfaCredential: true } });
  const cred = user?.mfaCredential;
  const fail = async (why: string) => {
    await recordActivity(db, { actorName: user?.name ?? "Unknown", action: "mfa_failed", entityType: "Session", entityId: userId, entityLabel: "second-factor check failed", detail: why, ip: clientIp(request) });
    throw BAD_CODE();
  };
  if (!user || user.status !== "active" || !cred?.enabledAt) return fail("no active credential");

  if (input.recoveryCode) {
    const used = await db.mfaRecoveryCode.updateMany({ where: { userId, codeDigest: recoveryDigest(userId, input.recoveryCode), usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) return fail("bad recovery code");
    await recordActivity(db, { actorName: user.name, action: "mfa_reset", entityType: "Admin user", entityId: userId, entityLabel: user.name, detail: "recovery code used", ip: clientIp(request) });
    return "recovery";
  }
  const step = input.code ? matchTotp(decryptSecret(cred.secretEnc, userId), input.code.replace(/\s/g, ""), Date.now()) : null;
  if (step === null) return fail("bad code");
  if (!(await claimStep(userId, step))) return fail("replayed code");
  return "totp";
}

/** Completes login for a user who has passed the password step. */
export async function completeLoginMfa(request: Request, input: { code?: string; recoveryCode?: string }): Promise<IssuedSession & { recoveryCodesRemaining: number }> {
  const userId = await pendingMfaUser(request);
  if (getAuthConfig().mfaMethod === "email") {
    if (!input.code) throw BAD_CODE();
    await verifyLoginCode(request, userId, input.code.replace(/\s/g, ""));
  } else {
    await verifyMfaInput(request, userId, input);
  }
  const db = getDb();
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, employeeId: true } });
  const issued = await db.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
    const s = await createSession(tx, request, user, { mfaVerified: true });
    await recordActivity(tx, { actorName: user.name, action: "login", entityType: "Session", entityId: userId, entityLabel: `${user.name} signed in (MFA)`, ip: clientIp(request) });
    return s;
  });
  return { ...issued, recoveryCodesRemaining: await db.mfaRecoveryCode.count({ where: { userId, usedAt: null } }) };
}

/* ───────────────────────── enrolment ───────────────────────── */

const emailOnly = () => errors.conflict("This server signs you in with emailed codes; there is no authenticator app to set up.");

/** Re-sends the sign-in code (honours the resend cooldown; a new code replaces the old one). */
export async function resendLoginCode(request: Request) {
  if (getAuthConfig().mfaMethod !== "email") throw emailOnly();
  const userId = await pendingMfaUser(request);
  const user = await getDb().adminUser.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, status: true } });
  if (!user || user.status !== "active") throw new ApiError(401, "mfa_session_expired", "Your sign-in step expired. Sign in again.");
  return sendLoginCode(request, user);
}

export async function startEnrollment(request: Request, subject: MfaSubject) {
  if (getAuthConfig().mfaMethod === "email") throw emailOnly();
  await enforce(`mfa:src:${sourceKey(request)}`, LIMITS.mfaSource);
  const db = getDb();
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: subject.userId }, select: { id: true, email: true, status: true, mfaCredential: true } });
  if (user.status !== "active") throw errors.unauthenticated();
  if (user.mfaCredential?.enabledAt) throw errors.conflict("Two-factor authentication is already enabled");
  const secret = generateTotpSecret();
  await db.mfaCredential.upsert({
    where: { userId: user.id },
    create: { userId: user.id, secretEnc: encryptSecret(secret, user.id) },
    update: { secretEnc: encryptSecret(secret, user.id), enabledAt: null, lastUsedStep: null },
  });
  const uri = otpauthUri(secret, user.email, getAuthConfig().mfaIssuer);
  // The secret is shown ONCE, here, so it can be scanned or typed into an authenticator app. It is never returned again.
  return { secret, otpauthUri: uri, qrDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
}

/** Confirms the first code, enables MFA and returns the one-time recovery codes. Signs in a pending user. */
export async function confirmEnrollment(request: Request, subject: MfaSubject, code: string): Promise<{ recoveryCodes: string[]; issued: IssuedSession | null }> {
  if (getAuthConfig().mfaMethod === "email") throw emailOnly();
  await enforce(`mfa:src:${sourceKey(request)}`, LIMITS.mfaSource);
  await enforce(`mfa:acct:${subject.userId}`, LIMITS.mfaAccount);
  const db = getDb();
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: subject.userId }, select: { id: true, name: true, email: true, employeeId: true, status: true, mfaCredential: true } });
  const cred = user.mfaCredential;
  if (user.status !== "active" || !cred || cred.enabledAt) throw errors.conflict("Start enrolment first");
  const step = matchTotp(decryptSecret(cred.secretEnc, user.id), code.replace(/\s/g, ""), Date.now());
  if (step === null) {
    await recordActivity(db, { actorName: user.name, action: "mfa_failed", entityType: "Admin user", entityId: user.id, entityLabel: user.name, detail: "enrolment code rejected", ip: clientIp(request) });
    throw BAD_CODE();
  }
  const result = await db.$transaction(async (tx) => {
    const enabled = await tx.mfaCredential.updateMany({ where: { userId: user.id, enabledAt: null }, data: { enabledAt: new Date(), lastUsedStep: step } });
    if (enabled.count !== 1) throw errors.conflict("Two-factor authentication is already enabled");
    await tx.adminUser.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    const recoveryCodes = await replaceRecoveryCodes(tx, user.id);
    await recordActivity(tx, { session: subject.session, actorName: user.name, action: "mfa_enrolled", entityType: "Admin user", entityId: user.id, entityLabel: user.name, detail: "TOTP enabled", ip: clientIp(request) });
    let issued: IssuedSession | null = null;
    if (subject.pending) {
      await tx.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      issued = await createSession(tx, request, user, { mfaVerified: true });
    } else if (subject.session) {
      await tx.session.update({ where: { id: subject.session.sessionId }, data: { mfaVerifiedAt: new Date() } });
    }
    return { recoveryCodes, issued };
  });
  await deferDelivery(() => sendSecurityNotice(user, "mfa_enabled"));
  return result;
}

export async function regenerateRecoveryCodes(request: Request, session: AuthSession): Promise<string[]> {
  const db = getDb();
  const enabled = await db.mfaCredential.findFirst({ where: { userId: session.user.id, enabledAt: { not: null } } });
  if (!enabled) throw errors.conflict("Two-factor authentication is not enabled");
  const codes = await db.$transaction(async (tx) => {
    const c = await replaceRecoveryCodes(tx, session.user.id);
    await recordActivity(tx, { session, action: "mfa_enrolled", entityType: "Admin user", entityId: session.user.id, entityLabel: session.user.name, detail: "recovery codes regenerated", ip: clientIp(request) });
    return c;
  });
  return codes;
}

export async function mfaStatus(userId: string) {
  const db = getDb();
  const [enabled, remaining, required] = await Promise.all([
    db.mfaCredential.findFirst({ where: { userId, enabledAt: { not: null } }, select: { enabledAt: true } }),
    db.mfaRecoveryCode.count({ where: { userId, usedAt: null } }),
    requiresMfa(db, userId),
  ]);
  return { method: getAuthConfig().mfaMethod, enabled: !!enabled, required, recoveryCodesRemaining: enabled ? remaining : 0 };
}

/* ───────────────────────── removal ───────────────────────── */

/** A user may turn off their own MFA only when their roles do not REQUIRE it. */
export async function disableOwnMfa(request: Request, session: AuthSession) {
  const db = getDb();
  if (await requiresMfa(db, session.user.id)) throw errors.forbidden();
  await db.$transaction(async (tx) => {
    await tx.mfaCredential.deleteMany({ where: { userId: session.user.id } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: session.user.id } });
    await tx.adminUser.update({ where: { id: session.user.id }, data: { twoFactorEnabled: false } });
    await recordActivity(tx, { session, action: "mfa_disabled", entityType: "Admin user", entityId: session.user.id, entityLabel: session.user.name, detail: "disabled by the user", ip: clientIp(request) });
  });
  await deferDelivery(() => sendSecurityNotice({ name: session.user.name, email: session.user.email }, "mfa_disabled"));
}

/**
 * Another employee's MFA (lost device) can be reset ONLY by a Super Admin, never for oneself, and never by an ordinary
 * employee or Admin. The target's sessions are revoked and they must enrol again at next sign-in.
 * (The caller has already checked authorization, delegation and recent authentication.)
 */
export async function resetEmployeeMfa(request: Request, session: AuthSession, targetId: string) {
  if (!session.access.isSuperAdmin) throw errors.forbidden();
  if (targetId === session.user.id) throw errors.delegation("Use your own security settings to change your own two-factor authentication");
  const db = getDb();
  const target = await db.adminUser.findUnique({ where: { id: targetId }, select: { id: true, name: true, email: true } });
  if (!target) throw errors.notFound("Employee");
  await db.$transaction(async (tx) => {
    await tx.mfaCredential.deleteMany({ where: { userId: targetId } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: targetId } });
    await tx.adminUser.update({ where: { id: targetId }, data: { twoFactorEnabled: false } });
    await revokeUserSessions(tx, targetId);
    await recordActivity(tx, { session, action: "mfa_reset", entityType: "Admin user", entityId: targetId, entityLabel: target.name, detail: "two-factor authentication reset by an administrator", ip: clientIp(request) });
  });
  await deferDelivery(() => sendSecurityNotice(target, "mfa_reset"));
}

