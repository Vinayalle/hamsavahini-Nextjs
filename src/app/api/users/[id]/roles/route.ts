import { requireRecentAuth } from "@/server/auth";
import { authorize } from "@/server/rbac";
import { idParam, json, parseBody, requireSession, route } from "@/server/http";
import { setEmployeeRoles, setRolesInput } from "@/server/services/users";

export const dynamic = "force-dynamic";

export const PUT = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "users", "assign");
  requireRecentAuth(session); // step-up: high-risk operation
  const body = await parseBody(request, setRolesInput);
  return json(await setEmployeeRoles(session, idParam(id, "Employee"), body.roleIds));
});
