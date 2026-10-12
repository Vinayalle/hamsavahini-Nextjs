import { ApiError } from "@/server/errors";
import { clientIp } from "@/server/audit";
import { idParam, json, parseBody, requireSession, route } from "@/server/http";
import { authorize } from "@/server/rbac";
import { deleteResource, getResource, updateResource } from "@/server/resources/framework";
import { resourceFor } from "@/server/resources";

export const dynamic = "force-dynamic";

export const GET = route<{ resource: string; id: string }>(async (request, { resource, id }) => {
  const session = await requireSession(request);
  const cfg = resourceFor(resource);
  return json(await getResource(cfg, session, idParam(id, cfg.entity)));
});

export const PATCH = route<{ resource: string; id: string }>(async (request, { resource, id }) => {
  const session = await requireSession(request);
  const cfg = resourceFor(resource);
  authorize(session, cfg.permission, "view");
  if (cfg.readOnly || !cfg.patchSchema) throw new ApiError(405, "method_not_allowed", `${cfg.entity} records cannot be edited here`);
  authorize(session, cfg.permission, cfg.editAction ?? "edit"); // before the body is read
  const body = await parseBody(request, cfg.patchSchema);
  return json(await updateResource(cfg, { session, ip: clientIp(request) }, idParam(id, cfg.entity), body));
});

export const DELETE = route<{ resource: string; id: string }>(async (request, { resource, id }) => {
  const session = await requireSession(request);
  const cfg = resourceFor(resource);
  await deleteResource(cfg, { session, ip: clientIp(request) }, idParam(id, cfg.entity));
  return json({ ok: true });
});
