import { clientIp } from "@/server/audit";
import { authorizeAny } from "@/server/rbac";
import { json, parseBody, requireSession, route } from "@/server/http";
import { bulkCategories, bulkInput } from "@/server/services/categories";

export const dynamic = "force-dynamic";

export const POST = route(async (request) => {
  const session = await requireSession(request);
  authorizeAny(session, "categories", ["edit", "delete"]); // service then enforces the specific action
  const body = await parseBody(request, bulkInput);
  return json(await bulkCategories(session, body, clientIp(request)));
});
