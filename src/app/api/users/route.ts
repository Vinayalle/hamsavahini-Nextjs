import { authorize } from "@/server/rbac";
import { json, parseBody, parseQuery, requireSession, route } from "@/server/http";
import { createEmployee, employeeCreate, employeeListQuery, listEmployees } from "@/server/services/users";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const session = await requireSession(request);
  return json(await listEmployees(session, parseQuery(request, employeeListQuery)));
});

export const POST = route(async (request) => {
  const session = await requireSession(request);
  authorize(session, "users", "create"); // before reading the body
  const body = await parseBody(request, employeeCreate);
  return json(await createEmployee(session, body, request), { status: 201 });
});
