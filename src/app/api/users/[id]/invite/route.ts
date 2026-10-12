import { authorize } from "@/server/rbac";
import { idParam, json, requireSession, route } from "@/server/http";
import { inviteEmployee } from "@/server/services/users";

export const dynamic = "force-dynamic";

/** Sends an invitation (pending employee) or a password-reset link (active employee). */
export const POST = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "users", "edit");
  return json(await inviteEmployee(session, idParam(id, "Employee"), request));
});
