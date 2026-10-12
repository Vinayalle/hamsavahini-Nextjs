import { z } from "zod";
import { setActivationPassword } from "@/server/account";
import { withCookies } from "@/server/cookies";
import { json, parseBody, route } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ password: z.string().min(1).max(200) });

/** Public (the HttpOnly activation grant is the credential). Activates the account; the user then signs in normally. */
export const POST = route(async (request) => {
  const { password } = await parseBody(request, body);
  const cookies = await setActivationPassword(request, password);
  return withCookies(json({ ok: true }), cookies);
});
