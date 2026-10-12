import { z } from "zod";
import { confirmEnrollment, resolveSubject } from "@/server/mfa";
import { withCookies } from "@/server/cookies";
import { json, parseBody, route } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ code: z.string().trim().regex(/^\d{3}\s?\d{3}$/, "Enter the 6-digit code") });

/** Enables MFA, returns the one-time recovery codes (shown once) and, for a pending sign-in, completes it. */
export const POST = route(async (request) => {
  const subject = await resolveSubject(request);
  const { code } = await parseBody(request, body);
  const r = await confirmEnrollment(request, subject, code);
  const res = json({ ok: true, recoveryCodes: r.recoveryCodes, ...(r.issued ? { status: "authenticated", user: r.issued.user } : {}) });
  return r.issued ? withCookies(res, r.issued.cookies) : res;
});
