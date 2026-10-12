import { requireRecentAuth } from "@/server/auth";
import { authorize } from "@/server/rbac";
import { idParam, json, parseBody, requireSession, route } from "@/server/http";
import { deleteRole, getRole, rolePatch, updateRole } from "@/server/services/roles";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  return json(await getRole(session, idParam(id, "Role")));
});

export const PATCH = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "roles", "edit");
  const body = await parseBody(request, rolePatch);
  return json(await updateRole(session, idParam(id, "Role"), body));
});

export const DELETE = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "roles", "delete");
  requireRecentAuth(session); // step-up: high-risk operation
  await deleteRole(session, idParam(id, "Role"));
  return json({ ok: true });
});
