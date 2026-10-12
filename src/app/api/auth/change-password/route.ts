import { z } from "zod";
import { changeOwnPassword } from "@/server/account";
import { json, parseBody, requireSession, route } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ current: z.string().min(1).max(200), next: z.string().min(1).max(200) });

export const POST = route(async (request) => {
  const session = await requireSession(request);
  const { current, next } = await parseBody(request, body);
  await changeOwnPassword(request, session, current, next);
  return json({ ok: true });
});
