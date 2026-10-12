import { z } from "zod";
import { clientIp } from "@/server/audit";
import { errors } from "@/server/errors";
import { authorize } from "@/server/rbac";
import { json, parseBody, requireSession, route } from "@/server/http";
import { deleteProduct, getProduct, productPatch, updateProduct } from "@/server/services/products";

export const dynamic = "force-dynamic";

const idSchema = z.uuid();
const parseId = (id: string) => {
  const r = idSchema.safeParse(id);
  if (!r.success) throw errors.notFound("Product"); // malformed ids are indistinguishable from unknown ones
  return r.data;
};

export const GET = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  return json(await getProduct(session, parseId(id)));
});

export const PATCH = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "products", "edit"); // authorize before reading/validating the body
  const body = await parseBody(request, productPatch);
  return json(await updateProduct(session, parseId(id), body, clientIp(request)));
});

export const DELETE = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  await deleteProduct(session, parseId(id), clientIp(request));
  return json({ ok: true });
});
