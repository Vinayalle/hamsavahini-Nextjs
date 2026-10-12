import { authorize } from "@/server/rbac";
import { idParam, json, parseBody, requireSession, route } from "@/server/http";
import { dashboardInput, getEmployeeDashboard, resetEmployeeDashboard, setEmployeeDashboard } from "@/server/services/users";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  return json(await getEmployeeDashboard(session, idParam(id, "Employee")));
});

export const PUT = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "user_dashboards", "edit");
  const body = await parseBody(request, dashboardInput);
  return json(await setEmployeeDashboard(session, idParam(id, "Employee"), body));
});

/** Reset to the default dashboard. */
export const DELETE = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "user_dashboards", "edit");
  return json(await resetEmployeeDashboard(session, idParam(id, "Employee")));
});
