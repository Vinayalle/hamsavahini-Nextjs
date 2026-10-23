import { z } from "zod";
import { login } from "@/server/auth";
import { withCookies } from "@/server/cookies";
import { json, parseBody, route } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().min(1, "Email is required").max(254), password: z.string().min(1, "Password is required").max(200) });

/** Step one of sign-in. A correct password answers "mfa_required" and emails the code; the session starts only after the code (mfa/verify). */
export const POST = route(async (request) => {
  const { email, password } = await parseBody(request, body);
  const result = await login(request, email, password);
  return withCookies(json({ status: "mfa_required", maskedEmail: result.maskedEmail }), result.cookies);
});
