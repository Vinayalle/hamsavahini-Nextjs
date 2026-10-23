import "server-only";
import { getDb } from "./db";
import { ApiError } from "./errors";
import { clientIp, recordActivity } from "./audit";
import { createSession, pendingMfaUser, type IssuedSession } from "./auth";
import { sendLoginCode, verifyLoginCode } from "./loginotp";

/**
 * The second sign-in step: a 6-digit code emailed after the correct password (see loginotp.ts for how codes are stored and limited).
 * There is no authenticator app and no recovery code; an employee who cannot receive email asks an administrator to fix the address.
 */

/** Completes sign-in for a user who has passed the password step. */
export async function completeLoginMfa(request: Request, input: { code: string }): Promise<IssuedSession> {
  const userId = await pendingMfaUser(request);
  await verifyLoginCode(request, userId, input.code.replace(/\s/g, ""));
  const db = getDb();
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, employeeId: true } });
  return db.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
    const s = await createSession(tx, request, user, { mfaVerified: true });
    await recordActivity(tx, { actorName: user.name, action: "login", entityType: "Session", entityId: userId, entityLabel: `${user.name} signed in (emailed code)`, ip: clientIp(request) });
    return s;
  });
}

/** Re-sends the sign-in code (honours the resend cooldown; a new code replaces the old one). */
export async function resendLoginCode(request: Request) {
  const userId = await pendingMfaUser(request);
  const user = await getDb().adminUser.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, status: true } });
  if (!user || user.status !== "active") throw new ApiError(401, "mfa_session_expired", "Your sign-in step expired. Sign in again.");
  return sendLoginCode(request, user);
}
