import { requireRecentAuth } from "@/server/auth";
import { authorize } from "@/server/rbac";
import { idParam, json, requireSession, route } from "@/server/http";
import { resetEmployeeMfa } from "@/server/mfa";

export const dynamic = "force-dynamic";

/**
 * Lost-device recovery: resets another employee's two-factor authentication. Only a Super Admin may do this (an ordinary
 * employee or Admin can never weaken an administrator's MFA), never for themselves, and only after a recent re-authentication.
 */
export const POST = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "users", "edit");
  requireRecentAuth(session);
  await resetEmployeeMfa(request, session, idParam(id, "Employee"));
  return json({ ok: true });
});
