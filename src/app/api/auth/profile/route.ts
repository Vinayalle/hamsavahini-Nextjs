import { z } from "zod";
import { json, parseBody, requireSession, route } from "@/server/http";
import { getOwnProfile, updateEmployee } from "@/server/services/users";

export const dynamic = "force-dynamic";

/** Own profile: any signed-in employee. Self-service editing is limited to name and phone. */
export const GET = route(async (request) => {
  const session = await requireSession(request);
  return json(await getOwnProfile(session));
});

const patch = z.object({ name: z.string().trim().min(2).max(120), phone: z.string().trim().max(30).nullable() }).partial().strict();

export const PATCH = route(async (request) => {
  const session = await requireSession(request);
  const body = await parseBody(request, patch);
  await updateEmployee(session, session.user.id, body, request);
  return json(await getOwnProfile(session));
});
