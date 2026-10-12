import { authorize } from "@/server/rbac";
import { idParam, json, parseBody, requireSession, route } from "@/server/http";
import { roleUsersInput, updateRoleEmployees } from "@/server/services/roles";

export const dynamic = "force-dynamic";

export const PUT = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "roles", "assign");
  const body = await parseBody(request, roleUsersInput);
  return json(await updateRoleEmployees(session, idParam(id, "Role"), body));
});
