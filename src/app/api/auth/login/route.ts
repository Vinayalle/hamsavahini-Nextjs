import { z } from "zod";
import { login } from "@/server/auth";
import { withCookies } from "@/server/cookies";
import { json, parseBody, route } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().min(1, "Email is required").max(254), password: z.string().min(1, "Password is required").max(200) });

/** Credentials never appear in the response; tokens travel only in HttpOnly cookies. */
export const POST = route(async (request) => {
  const { email, password } = await parseBody(request, body);
  const result = await login(request, email, password);
  if (result.kind === "mfa") return withCookies(json({ status: "mfa_required", method: result.method, enrolled: result.enrolled, ...(result.maskedEmail ? { maskedEmail: result.maskedEmail } : {}) }), result.cookies);
  return withCookies(json({ status: "authenticated", user: result.user }), result.cookies);
});
