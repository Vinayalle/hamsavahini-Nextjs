import { clientIp } from "@/server/audit";
import { authorize } from "@/server/rbac";
import { json, parseBody, parseQuery, requireSession, route } from "@/server/http";
import { createProduct, listProducts, productInput, productListQuery } from "@/server/services/products";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const session = await requireSession(request);
  return json(await listProducts(session, parseQuery(request, productListQuery)));
});

export const POST = route(async (request) => {
  const session = await requireSession(request);
  authorize(session, "products", "create"); // authorize before reading/validating the body
  const body = await parseBody(request, productInput);
  return json(await createProduct(session, body, clientIp(request)), { status: 201 });
});
