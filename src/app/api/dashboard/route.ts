import { json, requireSession, route } from "@/server/http";
import { getOwnDashboard } from "@/server/services/dashboard";

export const dynamic = "force-dynamic";

/** The signed-in employee's dashboard: only widgets and numbers they are entitled to. */
export const GET = route(async (request) => {
  const session = await requireSession(request);
  return json(await getOwnDashboard(session));
});
