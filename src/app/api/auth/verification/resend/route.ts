import { z } from "zod";
import { requestActivationOtp } from "@/server/account";
import { json, parseBody, route } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().min(3).max(254) });

/** Public. Same behaviour (and the same generic answer) as request-otp; a resend invalidates the previous code and honours the cooldown. */
export const POST = route(async (request) => {
  const { email } = await parseBody(request, body);
  await requestActivationOtp(request, email);
  return json({ ok: true, message: "If this email has a pending invitation, a verification code has been sent." });
});
