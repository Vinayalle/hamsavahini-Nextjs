import { z } from "zod";
import { reauthenticate } from "@/server/auth";
import { verifyMfaInput } from "@/server/mfa";
import { getDb } from "@/server/db";
import { json, parseBody, requireSession, route } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({
  password: z.string().min(1).max(200),
  code: z.string().trim().max(12).optional(),
  recoveryCode: z.string().trim().max(20).optional(),
});

/** Step-up authentication for high-risk operations: password, plus a second factor if the account has one. */
export const POST = route(async (request) => {
  const session = await requireSession(request);
  const input = await parseBody(request, body);
  await reauthenticate(request, session, input.password, async (userId) => {
    const enrolled = await getDb().mfaCredential.findFirst({ where: { userId, enabledAt: { not: null } }, select: { userId: true } });
    if (enrolled) await verifyMfaInput(request, userId, { code: input.code, recoveryCode: input.recoveryCode });
  });
  return json({ ok: true });
});
