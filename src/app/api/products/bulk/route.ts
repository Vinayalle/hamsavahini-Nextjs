import { clientIp } from "@/server/audit";
import { authorizeAny } from "@/server/rbac";
import { json, parseBody, requireSession, route } from "@/server/http";
import { bulkProducts, productBulkInput } from "@/server/services/products";

export const dynamic = "force-dynamic";

export const POST = route(async (request) => {
  const session = await requireSession(request);
  authorizeAny(session, "products", ["edit", "delete"]); // service then enforces the specific action
  const body = await parseBody(request, productBulkInput);
  return json(await bulkProducts(session, body, clientIp(request)));
});
