import { z } from "zod";
import { completeLoginMfa } from "@/server/mfa";
import { withCookies } from "@/server/cookies";
import { json, parseBody, route } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ code: z.string().trim().max(12).optional(), recoveryCode: z.string().trim().max(20).optional() }).refine((b) => !!b.code !== !!b.recoveryCode, "Provide a code or a recovery code");

/** Second step of sign-in for accounts that require MFA. Needs the short-lived hv_mfa proof from a correct password. */
export const POST = route(async (request) => {
  const input = await parseBody(request, body);
  const r = await completeLoginMfa(request, input);
  return withCookies(json({ status: "authenticated", user: r.user, recoveryCodesRemaining: r.recoveryCodesRemaining }), r.cookies);
});
