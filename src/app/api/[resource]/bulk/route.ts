import { ApiError } from "@/server/errors";
import { clientIp } from "@/server/audit";
import { json, parseBody, requireSession, route } from "@/server/http";
import { authorizeAny } from "@/server/rbac";
import { bulkResource, bulkSchema } from "@/server/resources/framework";
import { resourceFor } from "@/server/resources";

export const dynamic = "force-dynamic";

export const POST = route<{ resource: string }>(async (request, { resource }) => {
  const session = await requireSession(request);
  const cfg = resourceFor(resource);
  if (cfg.readOnly) throw new ApiError(405, "method_not_allowed", "Not supported");
  authorizeAny(session, cfg.permission, [cfg.editAction ?? "edit", ...(cfg.noDelete ? [] : ["delete"])]); // before the body is read
  const body = await parseBody(request, bulkSchema);
  return json(await bulkResource(cfg, { session, ip: clientIp(request) }, body));
});
