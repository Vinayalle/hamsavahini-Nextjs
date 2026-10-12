import { requireRecentAuth } from "@/server/auth";
import { authorize } from "@/server/rbac";
import { idParam, json, parseBody, requireSession, route } from "@/server/http";
import { roleGrantsInput, setRoleGrants } from "@/server/services/roles";

export const dynamic = "force-dynamic";

export const PUT = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "roles", "manage_permissions");
  requireRecentAuth(session); // step-up: high-risk operation
  const body = await parseBody(request, roleGrantsInput);
  return json(await setRoleGrants(session, idParam(id, "Role"), body));
});
