import { getDb } from "@/server/db";
import { json, requireSession, route } from "@/server/http";
import { can } from "@/server/rbac";
import { errors } from "@/server/errors";

export const dynamic = "force-dynamic";

/**
 * People a record can be assigned to (id + name only: no email, phone or roles). Available only to employees who can assign
 * RFQs, contact enquiries or roles, so it cannot be used to enumerate staff.
 */
export const GET = route(async (request) => {
  const session = await requireSession(request);
  if (!can(session, "rfqs", "assign") && !can(session, "enquiries", "assign") && !can(session, "users", "assign")) throw errors.forbidden();
  const rows = await getDb().adminUser.findMany({ where: { status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 });
  return json({ items: rows });
});
