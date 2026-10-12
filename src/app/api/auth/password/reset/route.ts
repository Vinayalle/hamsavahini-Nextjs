import { z } from "zod";
import { resetPassword } from "@/server/account";
import { json, parseBody, route } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ token: z.string().min(20).max(200), password: z.string().min(1).max(200) });

export const POST = route(async (request) => {
  const { token, password } = await parseBody(request, body);
  await resetPassword(request, token, password);
  return json({ ok: true });
});
