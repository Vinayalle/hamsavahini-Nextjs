import { z } from "zod";
import { clientIp } from "@/server/audit";
import { errors } from "@/server/errors";
import { authorize } from "@/server/rbac";
import { json, parseBody, requireSession, route } from "@/server/http";
import { deleteCategory, getCategory, categoryPatch, updateCategory } from "@/server/services/categories";

export const dynamic = "force-dynamic";

const idSchema = z.uuid();
const parseId = (id: string) => {
  const r = idSchema.safeParse(id);
  if (!r.success) throw errors.notFound("Category"); // malformed ids are indistinguishable from unknown ones
  return r.data;
};

export const GET = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  return json(await getCategory(session, parseId(id)));
});

export const PATCH = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "categories", "edit"); // authorize before reading/validating the body
  const body = await parseBody(request, categoryPatch);
  return json(await updateCategory(session, parseId(id), body, clientIp(request)));
});

export const DELETE = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  await deleteCategory(session, parseId(id), clientIp(request));
  return json({ ok: true });
});
