import { z } from "zod";
import { reauthenticate } from "@/server/auth";
import { json, parseBody, requireSession, route } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ password: z.string().min(1).max(200) });

/** Step-up authentication for high-risk operations: the signed-in employee enters their password again. */
export const POST = route(async (request) => {
  const session = await requireSession(request);
  const input = await parseBody(request, body);
  await reauthenticate(request, session, input.password);
  return json({ ok: true });
});
