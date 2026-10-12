import { resendLoginCode } from "@/server/mfa";
import { json, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** Sends the sign-in code again (needs the short-lived proof from a correct password). Honours the resend cooldown. */
export const POST = route(async (request) => {
  const r = await resendLoginCode(request);
  return json({ ok: true, sent: r.sent, retryAfterSeconds: r.retryAfterSeconds ?? null });
});
