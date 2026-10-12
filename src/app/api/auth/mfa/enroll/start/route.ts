import { resolveSubject, startEnrollment } from "@/server/mfa";
import { json, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** Works for a user who just passed the password step (pending) or for a signed-in user adding MFA voluntarily. */
export const POST = route(async (request) => {
  const subject = await resolveSubject(request);
  return json(await startEnrollment(request, subject));
});
