import { requireRecentAuth } from "@/server/auth";
import { regenerateRecoveryCodes } from "@/server/mfa";
import { json, requireSession, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** New recovery codes replace all old ones. Step-up: the user must have re-entered their credentials recently. */
export const POST = route(async (request) => {
  const session = await requireSession(request);
  requireRecentAuth(session);
  return json({ recoveryCodes: await regenerateRecoveryCodes(request, session) });
});
