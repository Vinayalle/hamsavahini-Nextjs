import { hasPermission } from "@/lib/authz/resolve";
import { requirementForPath } from "@/lib/authz/catalog";
import { getSession } from "@/server/auth";
import { json, route } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * Server-side page gate. `proxy.ts` calls this for every /admin page request (full loads AND client navigations)
 * with the visitor's cookie. The decision is made from the database on each call, so a revoked permission or a
 * deactivated account is enforced on the very next request.
 */
export const GET = route(async (request) => {
  const path = new URL(request.url).searchParams.get("path") ?? "";
  const session = await getSession(request);
  if (!session) return json({ allowed: false, reason: "unauthenticated" });
  const req = requirementForPath(path);
  if (req.kind === "open") return json({ allowed: true, reason: "ok" });
  if (req.kind === "permission") return json({ allowed: hasPermission(session.access, req.resource, req.action), reason: hasPermission(session.access, req.resource, req.action) ? "ok" : "forbidden" });
  // Unknown admin routes: only a Super Admin passes (they will 404 anyway); everyone else is denied.
  return json({ allowed: session.access.isSuperAdmin, reason: session.access.isSuperAdmin ? "ok" : "forbidden" });
});
