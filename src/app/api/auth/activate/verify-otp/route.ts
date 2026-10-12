import { z } from "zod";
import { verifyActivationOtp } from "@/server/account";
import { withCookies } from "@/server/cookies";
import { json, parseBody, route } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().min(3).max(254), code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") });

/** Public. On success the activation grant is set as an HttpOnly cookie; it is never readable by page scripts. */
export const POST = route(async (request) => {
  const { email, code } = await parseBody(request, body);
  const cookies = await verifyActivationOtp(request, email, code);
  return withCookies(json({ ok: true }), cookies);
});
