import { requireRecentAuth } from "@/server/auth";
import { authorize } from "@/server/rbac";
import { idParam, json, parseBody, requireSession, route } from "@/server/http";
import { setEmployeeStatus, statusInput } from "@/server/services/users";

export const dynamic = "force-dynamic";

export const POST = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "users", "change_status");
  requireRecentAuth(session); // step-up: high-risk operation
  const body = await parseBody(request, statusInput);
  return json(await setEmployeeStatus(session, idParam(id, "Employee"), body));
});
