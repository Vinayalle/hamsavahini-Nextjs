import { idParam, json, parseBody, requireSession, route } from "@/server/http";
import { employeePatch, getEmployee, updateEmployee } from "@/server/services/users";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  return json(await getEmployee(session, idParam(id, "Employee")));
});

/** Self-service edits (name, phone) and administrator edits share this route; the service tells them apart. */
export const PATCH = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  const body = await parseBody(request, employeePatch);
  return json(await updateEmployee(session, idParam(id, "Employee"), body, request));
});
