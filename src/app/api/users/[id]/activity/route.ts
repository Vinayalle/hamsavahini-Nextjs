import { idParam, json, requireSession, route } from "@/server/http";
import { getEmployeeActivity } from "@/server/services/users";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  return json(await getEmployeeActivity(session, idParam(id, "Employee")));
});
