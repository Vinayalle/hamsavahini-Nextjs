import { z } from "zod";
import { requestActivationOtp } from "@/server/account";
import { json, parseBody, route } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().min(3).max(254) });

/** Public. Identical response whether or not the address belongs to an invited employee (no enumeration). */
export const POST = route(async (request) => {
  const { email } = await parseBody(request, body);
  await requestActivationOtp(request, email);
  return json({ ok: true, message: "If this email has a pending invitation, a verification code has been sent." });
});
