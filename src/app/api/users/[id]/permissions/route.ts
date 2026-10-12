import { requireRecentAuth } from "@/server/auth";
import { authorize } from "@/server/rbac";
import { idParam, json, parseBody, requireSession, route } from "@/server/http";
import { getEmployeePermissions, overridesInput, setEmployeeOverrides } from "@/server/services/users";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  return json(await getEmployeePermissions(session, idParam(id, "Employee")));
});

export const PUT = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "user_permissions", "manage_permissions");
  requireRecentAuth(session); // step-up: high-risk operation
  const body = await parseBody(request, overridesInput);
  return json(await setEmployeeOverrides(session, idParam(id, "Employee"), body));
});
