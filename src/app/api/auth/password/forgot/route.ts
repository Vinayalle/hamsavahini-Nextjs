import { z } from "zod";
import { requestPasswordReset } from "@/server/account";
import { json, parseBody, route } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().min(1).max(254) });

/** Public. Always answers the same way, so it cannot be used to discover which emails have accounts. */
export const POST = route(async (request) => {
  const { email } = await parseBody(request, body);
  await requestPasswordReset(request, email);
  return json({ ok: true, message: "If an active account exists for that email, a reset link has been sent." });
});
