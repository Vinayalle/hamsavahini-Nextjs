import { ApiError } from "@/server/errors";
import { clientIp } from "@/server/audit";
import { json, parseBody, requireSession, route } from "@/server/http";
import { authorize } from "@/server/rbac";
import { createResource, listQuerySchema, listResource } from "@/server/resources/framework";
import { resourceFor } from "@/server/resources";

export const dynamic = "force-dynamic";

/** Generic CMS modules (posts, projects, careers, locations, banners, commodities, prices, opportunities, rfqs, ...). */
export const GET = route<{ resource: string }>(async (request, { resource }) => {
  const session = await requireSession(request);
  const cfg = resourceFor(resource);
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const q = listQuerySchema.safeParse(params);
  if (!q.success) throw new ApiError(422, "validation_failed", "Invalid query");
  // Only the filters this module declares are passed through.
  const filters = Object.fromEntries(Object.keys(cfg.filters ?? {}).filter((k) => params[k] !== undefined).map((k) => [k, params[k]]));
  return json(await listResource(cfg, session, { ...q.data, ...filters }));
});

export const POST = route<{ resource: string }>(async (request, { resource }) => {
  const session = await requireSession(request);
  const cfg = resourceFor(resource);
  authorize(session, cfg.permission, "view"); // whoever cannot even see the module learns nothing about it (no 405 oracle)
  if (cfg.readOnly || !cfg.createSchema) throw new ApiError(405, "method_not_allowed", `${cfg.entity} records cannot be created here`);
  authorize(session, cfg.permission, "create"); // before the body is read
  const body = await parseBody(request, cfg.createSchema);
  return json(await createResource(cfg, { session, ip: clientIp(request) }, body), { status: 201 });
});
