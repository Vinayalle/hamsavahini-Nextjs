import { authorize } from "@/server/rbac";
import { json, parseBody, requireSession, route } from "@/server/http";
import { defaultDashboardInput, getDefaultDashboard, setDefaultDashboard } from "@/server/services/dashboard";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const session = await requireSession(request);
  return json(await getDefaultDashboard(session));
});

export const PUT = route(async (request) => {
  const session = await requireSession(request);
  authorize(session, "user_dashboards", "edit");
  const body = await parseBody(request, defaultDashboardInput);
  return json(await setDefaultDashboard(session, body));
});
