import { requireRecentAuth } from "@/server/auth";
import { authorize } from "@/server/rbac";
import { idParam, json, parseBody, requireSession, route } from "@/server/http";
import { roleStatusInput, setRoleStatus } from "@/server/services/roles";

export const dynamic = "force-dynamic";

export const POST = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "roles", "change_status");
  requireRecentAuth(session); // step-up: high-risk operation
  const body = await parseBody(request, roleStatusInput);
  return json(await setRoleStatus(session, idParam(id, "Role"), body.status));
});
