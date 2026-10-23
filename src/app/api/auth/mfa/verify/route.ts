import { z } from "zod";
import { completeLoginMfa } from "@/server/mfa";
import { withCookies } from "@/server/cookies";
import { json, parseBody, route } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ code: z.string().trim().min(1, "Enter the code").max(12) });

/** Second step of sign-in: the emailed 6-digit code. Needs the short-lived hv_mfa proof from a correct password. */
export const POST = route(async (request) => {
  const input = await parseBody(request, body);
  const r = await completeLoginMfa(request, input);
  return withCookies(json({ status: "authenticated", user: r.user }), r.cookies);
});
