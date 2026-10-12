import { authorize } from "@/server/rbac";
import { idParam, json, parseBody, requireSession, route } from "@/server/http";
import { duplicateRole, roleDuplicateInput } from "@/server/services/roles";

export const dynamic = "force-dynamic";

export const POST = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "roles", "create");
  const body = await parseBody(request, roleDuplicateInput);
  return json(await duplicateRole(session, idParam(id, "Role"), body), { status: 201 });
});
