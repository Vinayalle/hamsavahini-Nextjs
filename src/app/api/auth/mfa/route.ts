import { requireRecentAuth } from "@/server/auth";
import { disableOwnMfa, mfaStatus } from "@/server/mfa";
import { json, requireSession, route } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const session = await requireSession(request);
  return json(await mfaStatus(session.user.id));
});

/** Own MFA can be turned off only when none of the user's roles require it. Never accepts another user's id. */
export const DELETE = route(async (request) => {
  const session = await requireSession(request);
  requireRecentAuth(session);
  await disableOwnMfa(request, session);
  return json({ ok: true });
});
