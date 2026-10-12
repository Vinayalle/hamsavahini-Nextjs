import { authorize } from "@/server/rbac";
import { json, parseBody, parseQuery, requireSession, route } from "@/server/http";
import { createRole, listRoles, roleCreate, roleListQuery } from "@/server/services/roles";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const session = await requireSession(request);
  return json(await listRoles(session, parseQuery(request, roleListQuery)));
});

export const POST = route(async (request) => {
  const session = await requireSession(request);
  authorize(session, "roles", "create");
  const body = await parseBody(request, roleCreate);
  return json(await createRole(session, body), { status: 201 });
});
