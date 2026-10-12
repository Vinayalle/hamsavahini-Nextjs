import { clientIp } from "@/server/audit";
import { authorize } from "@/server/rbac";
import { json, parseBody, parseQuery, requireSession, route } from "@/server/http";
import { createCategory, listCategories, categoryInput, listQuery } from "@/server/services/categories";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const session = await requireSession(request);
  return json(await listCategories(session, parseQuery(request, listQuery)));
});

export const POST = route(async (request) => {
  const session = await requireSession(request);
  authorize(session, "categories", "create"); // authorize before reading/validating the body
  const body = await parseBody(request, categoryInput);
  return json(await createCategory(session, body, clientIp(request)), { status: 201 });
});
