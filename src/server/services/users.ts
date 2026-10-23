import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { isValidPermission, QUICK_ACTION_BY_KEY, WIDGET_BY_KEY, parsePermKey, getResource, WIDGETS, QUICK_ACTIONS } from "@/lib/authz/catalog";
import { hasPermission, resolveEffective, type OverrideInput, type RoleInput, type Scope } from "@/lib/authz/resolve";
import { nextEmployeeId } from "@/lib/authz/bootstrap";
import { getDb } from "../db";
import { recordActivity } from "../audit";
import { sendAccountLink, type InviteResult } from "../account";
import type { AuthSession } from "../auth";
import { errors } from "../errors";
import { authorize } from "../rbac";
import { loadAccess, loadAccessMany, SUPER_ADMIN_CODE } from "../authz/access";
import {
  assertCanGrantAll, assertManageable, assertNotLastSuperAdmin, assertNotSelf, assertRolesAssignable, assertWithinAuthority,
} from "../authz/delegation";
import { recordAccessChange } from "../authz/history";

/* ───────────────────────── schemas ───────────────────────── */

const email = z.string().trim().toLowerCase().email("Enter a valid email").max(254);
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

export const employeeCreate = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email,
  employeeId: z.string().trim().regex(/^[A-Za-z0-9-]{3,20}$/, "Use 3-20 letters, numbers or hyphens").transform((v) => v.toUpperCase()).optional(),
  phone: optionalText(30),
  department: optionalText(80),
  designation: optionalText(80),
  reportingManagerId: z.uuid().nullable().optional(),
  roleIds: z.array(z.uuid()).max(12).default([]),
});
export type EmployeeCreate = z.infer<typeof employeeCreate>;

export const employeePatch = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  phone: optionalText(30),
  department: optionalText(80),
  designation: optionalText(80),
  reportingManagerId: z.uuid().nullable(),
}).partial();

export const employeeListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  department: z.string().trim().max(80).optional(),
  roleId: z.uuid().optional(),
  status: z.enum(["active", "invited", "suspended"]).optional(),
  lastLogin: z.enum(["7d", "30d", "never"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "employeeId", "email", "department", "status", "lastLoginAt", "createdAt"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const setRolesInput = z.object({ roleIds: z.array(z.uuid()).max(12) });
export const statusInput = z.object({ status: z.enum(["active", "suspended"]), reason: z.string().trim().max(300).optional() });
export const overridesInput = z.object({
  overrides: z.array(z.object({
    resource: z.string(), action: z.string(), effect: z.enum(["allow", "deny"]), scope: z.enum(["all", "assigned"]).default("all"),
  })).max(400),
  reason: z.string().trim().max(300).optional(),
});
export const dashboardInput = z.object({
  widgets: z.array(z.object({ key: z.string(), enabled: z.boolean(), order: z.number().int().min(0).max(1000) })).max(50),
  quickActions: z.array(z.string()).max(20),
});

/* ───────────────────────── DTOs ───────────────────────── */

const employeeSelect = {
  id: true, employeeId: true, name: true, email: true, phone: true, department: true, designation: true, status: true,
  lastLoginAt: true, createdAt: true, updatedAt: true, deactivatedAt: true,
  reportingManager: { select: { id: true, name: true } },
  roles: { select: { assignedAt: true, role: { select: { id: true, name: true, code: true, status: true } } } },
} satisfies Prisma.AdminUserSelect;
type EmployeeRow = Prisma.AdminUserGetPayload<{ select: typeof employeeSelect }>;

export function toEmployeeDto(u: EmployeeRow, pageCount: number, isSuperAdmin: boolean) {
  return {
    id: u.id, employeeId: u.employeeId, name: u.name, email: u.email, phone: u.phone, department: u.department, designation: u.designation,
    reportingManager: u.reportingManager, status: u.status,
    roles: u.roles.map((r) => ({ id: r.role.id, name: r.role.name, code: r.role.code, status: r.role.status })),
    assignedPageCount: pageCount, isSuperAdmin,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null, createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString(), deactivatedAt: u.deactivatedAt?.toISOString() ?? null,
  };
}

const viewCount = (access: { grants: ReadonlyMap<string, unknown> }) => Array.from(access.grants.keys()).filter((k) => k.endsWith(":view")).length;

/* ───────────────────────── queries ───────────────────────── */

export async function listEmployees(session: AuthSession, q: z.infer<typeof employeeListQuery>) {
  authorize(session, "users", "view");
  const where: Prisma.AdminUserWhereInput = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.department ? { department: q.department } : {}),
    ...(q.roleId ? { roles: { some: { roleId: q.roleId } } } : {}),
    ...(q.lastLogin === "never" ? { lastLoginAt: null } : q.lastLogin ? { lastLoginAt: { gte: new Date(Date.now() - (q.lastLogin === "7d" ? 7 : 30) * 86400_000) } } : {}),
    ...(q.search ? { OR: [{ name: { contains: q.search, mode: "insensitive" } }, { email: { contains: q.search, mode: "insensitive" } }, { employeeId: { contains: q.search, mode: "insensitive" } }] } : {}),
  };
  const db = getDb();
  const [total, rows] = await Promise.all([
    db.adminUser.count({ where }),
    db.adminUser.findMany({ where, select: employeeSelect, orderBy: { [q.sortBy]: q.sortDir }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  const access = await loadAccessMany(db, rows.map((r) => r.id));
  const departments = (await db.adminUser.findMany({ where: { department: { not: null } }, distinct: ["department"], select: { department: true }, orderBy: { department: "asc" } })).map((d) => d.department!);
  return {
    items: rows.map((r) => toEmployeeDto(r, viewCount(access.get(r.id)!.potential), access.get(r.id)!.holdsSuperAdminRole)),
    total, page: q.page, pageSize: q.pageSize, pageCount: Math.max(1, Math.ceil(total / q.pageSize)), departments,
  };
}

export async function getEmployee(session: AuthSession, id: string) {
  authorize(session, "users", "view");
  const row = await getDb().adminUser.findUnique({ where: { id }, select: employeeSelect });
  if (!row) throw errors.notFound("Employee");
  const loaded = await loadAccess(getDb(), id);
  return toEmployeeDto(row, viewCount(loaded.potential), loaded.holdsSuperAdminRole);
}

/* ───────────────────────── create / update ───────────────────────── */

async function assertManagerValid(db: ReturnType<typeof getDb>, managerId: string | null | undefined, selfId?: string) {
  if (!managerId) return;
  if (managerId === selfId) throw errors.invalid("An employee cannot report to themselves", { reportingManagerId: "An employee cannot report to themselves" });
  const manager = await db.adminUser.findUnique({ where: { id: managerId }, select: { id: true } });
  if (!manager) throw errors.invalid("Reporting manager does not exist", { reportingManagerId: "Reporting manager does not exist" });
  // no reporting cycles
  let cursor: string | null = managerId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    if (cursor === selfId) throw errors.invalid("That would create a reporting loop", { reportingManagerId: "That would create a reporting loop" });
    seen.add(cursor);
    const next: { reportingManagerId: string | null } | null = await db.adminUser.findUnique({ where: { id: cursor }, select: { reportingManagerId: true } });
    cursor = next?.reportingManagerId ?? null;
  }
}

async function loadRolesForAssignment(db: ReturnType<typeof getDb>, roleIds: string[]) {
  if (roleIds.length === 0) return [];
  const roles = await db.role.findMany({ where: { id: { in: roleIds } }, include: { permissions: { select: { scope: true, permission: { select: { resource: true, action: true } } } } } });
  if (roles.length !== new Set(roleIds).size) throw errors.invalid("One or more roles do not exist", { roleIds: "One or more roles do not exist" });
  return roles;
}

const toRoleInput = (r: { id: string; name: string; code: string; status: "active" | "inactive"; permissions: { scope: Scope; permission: { resource: string; action: string } }[] }): RoleInput => ({
  id: r.id, name: r.name, active: r.status === "active", isSuperAdmin: r.code === SUPER_ADMIN_CODE,
  grants: r.permissions.map((g) => ({ resource: g.permission.resource, action: g.permission.action, scope: g.scope })),
});

export async function createEmployee(session: AuthSession, input: EmployeeCreate, request: Request): Promise<{ employee: ReturnType<typeof toEmployeeDto>; invite: InviteResult }> {
  authorize(session, "users", "create");
  const db = getDb();
  if (input.roleIds.length) authorize(session, "users", "assign");
  if (await db.adminUser.findUnique({ where: { email: input.email }, select: { id: true } })) throw errors.conflict("An employee with this email already exists", { email: "An employee with this email already exists" });
  await assertManagerValid(db, input.reportingManagerId ?? null);
  const roles = await loadRolesForAssignment(db, input.roleIds);
  assertRolesAssignable(session, roles);
  // D4: the resulting employee must be within the actor's own authority.
  assertWithinAuthority(session, resolveEffective({ accountActive: true, roles: roles.map(toRoleInput), overrides: [] }));

  let created: EmployeeRow | undefined;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    try {
      const employeeId = input.employeeId ?? (await nextEmployeeId(db));
      if (input.employeeId && (await db.adminUser.findUnique({ where: { employeeId }, select: { id: true } }))) throw errors.conflict("This employee ID is already in use", { employeeId: "This employee ID is already in use" });
      created = await db.$transaction(async (tx) => {
        const row = await tx.adminUser.create({
          data: {
            employeeId, email: input.email, name: input.name, phone: input.phone, department: input.department, designation: input.designation,
            reportingManagerId: input.reportingManagerId ?? null, status: "invited",
            roles: { create: roles.map((r) => ({ roleId: r.id, assignedById: session.user.id })) },
          },
          select: employeeSelect,
        });
        await recordActivity(tx, { session, action: "created", entityType: "Admin user", entityId: row.id, entityLabel: row.name, detail: `${row.employeeId}, pending invitation`, ip: null });
        await recordAccessChange(tx, { session, targetType: "user", targetId: row.id, targetLabel: row.name, kind: "user_created", change: { employeeId: row.employeeId, roles: roles.map((r) => r.name) } });
        for (const r of roles) await recordAccessChange(tx, { session, targetType: "user", targetId: row.id, targetLabel: row.name, kind: "role_assigned", change: { role: r.name } });
        return row;
      });
    } catch (e) {
      // Concurrent creates can collide on the generated employee number: retry with the next one.
      if (!(e instanceof Error) || !/Unique constraint/i.test(e.message) || input.employeeId) throw e;
    }
  }
  if (!created) throw errors.conflict("Could not allocate an employee ID, please retry");
  const invite = await sendAccountLink(request, session, { id: created.id, email: created.email, name: created.name }, "invite");
  return { employee: toEmployeeDto(created, 0, false), invite };
}

export async function updateEmployee(session: AuthSession, id: string, patch: z.infer<typeof employeePatch>, request: Request) {
  const db = getDb();
  const target = await loadAccess(db, id);
  if (!target.user) throw errors.notFound("Employee");
  const self = session.user.id === id;
  if (self) {
    // Self-service is limited to non-organisational details; everything else needs another administrator.
    const forbidden = Object.keys(patch).filter((k) => !["name", "phone"].includes(k));
    if (forbidden.length) throw errors.delegation(`You cannot change your own ${forbidden.join(", ")}.`);
  } else {
    authorize(session, "users", "edit");
    assertManageable(session, target);
  }
  if (patch.reportingManagerId !== undefined) await assertManagerValid(db, patch.reportingManagerId, id);
  if (patch.email) {
    const dup = await db.adminUser.findUnique({ where: { email: patch.email }, select: { id: true } });
    if (dup && dup.id !== id) throw errors.conflict("An employee with this email already exists", { email: "An employee with this email already exists" });
  }
  const row = await db.$transaction(async (tx) => {
    const updated = await tx.adminUser.update({ where: { id }, data: patch, select: employeeSelect });
    await recordActivity(tx, { session, action: "updated", entityType: "Admin user", entityId: id, entityLabel: updated.name, detail: `Fields: ${Object.keys(patch).join(", ")}`, ip: null });
    return updated;
  });
  void request;
  const loaded = await loadAccess(db, id);
  return toEmployeeDto(row, viewCount(loaded.potential), loaded.holdsSuperAdminRole);
}

/* ───────────────────────── status ───────────────────────── */

export async function setEmployeeStatus(session: AuthSession, id: string, input: z.infer<typeof statusInput>) {
  authorize(session, "users", "change_status");
  const db = getDb();
  assertNotSelf(session, id, "account status");
  const target = await loadAccess(db, id);
  const current = await db.adminUser.findUnique({ where: { id }, select: { id: true, name: true, status: true, passwordHash: true } });
  if (!current || !target.user) throw errors.notFound("Employee");
  assertManageable(session, target);
  if (current.status === input.status) return getEmployee(session, id);
  if (input.status === "active" && !current.passwordHash) {
    throw errors.conflict("This employee has not accepted their invitation yet. Send an invitation instead of activating the account.");
  }
  await db.$transaction(async (tx) => {
    if (input.status === "suspended") await assertNotLastSuperAdmin(tx, id, "deactivate");
    await tx.adminUser.update({ where: { id }, data: { status: input.status, deactivatedAt: input.status === "suspended" ? new Date() : null } });
    // Deactivation takes effect immediately: kill every session and any unused links.
    if (input.status === "suspended") {
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.userToken.deleteMany({ where: { userId: id, usedAt: null } });
    }
    await recordActivity(tx, { session, action: "status_changed", entityType: "Admin user", entityId: id, entityLabel: current.name, detail: `Status -> ${input.status === "suspended" ? "deactivated" : "active"}${input.reason ? `: ${input.reason}` : ""}`, ip: null });
    await recordAccessChange(tx, { session, targetType: "user", targetId: id, targetLabel: current.name, kind: "status_changed", change: { from: current.status, to: input.status, reason: input.reason ?? null } });
  });
  return getEmployee(session, id);
}

/* ───────────────────────── roles ───────────────────────── */

export async function setEmployeeRoles(session: AuthSession, id: string, roleIds: string[]) {
  authorize(session, "users", "assign");
  const db = getDb();
  assertNotSelf(session, id, "roles");
  const target = await loadAccess(db, id);
  const user = await db.adminUser.findUnique({ where: { id }, select: { name: true, overrides: { select: { effect: true, scope: true, permission: { select: { resource: true, action: true } } } } } });
  if (!user || !target.user) throw errors.notFound("Employee");
  assertManageable(session, target);

  const wanted = Array.from(new Set(roleIds));
  const current = target.roles.map((r) => r.id);
  const add = wanted.filter((r) => !current.includes(r));
  const remove = current.filter((r) => !wanted.includes(r));
  if (add.length === 0 && remove.length === 0) return getEmployee(session, id);

  const newRoles = await loadRolesForAssignment(db, wanted);
  const addedRoles = newRoles.filter((r) => add.includes(r.id));
  assertRolesAssignable(session, addedRoles);
  const removedRoles = target.roles.filter((r) => remove.includes(r.id));

  // D4 on the RESULTING access.
  const overrides: OverrideInput[] = user.overrides.map((o) => ({ resource: o.permission.resource, action: o.permission.action, effect: o.effect, scope: o.scope }));
  assertWithinAuthority(session, resolveEffective({ accountActive: true, roles: newRoles.map(toRoleInput), overrides }));

  await db.$transaction(async (tx) => {
    if (removedRoles.some((r) => r.code === SUPER_ADMIN_CODE)) await assertNotLastSuperAdmin(tx, id, "remove the Super Admin role from");
    if (remove.length) await tx.userRole.deleteMany({ where: { userId: id, roleId: { in: remove } } });
    if (add.length) await tx.userRole.createMany({ data: add.map((roleId) => ({ userId: id, roleId, assignedById: session.user.id })) });
    for (const r of addedRoles) await recordAccessChange(tx, { session, targetType: "user", targetId: id, targetLabel: user.name, kind: "role_assigned", change: { role: r.name } });
    for (const r of removedRoles) await recordAccessChange(tx, { session, targetType: "user", targetId: id, targetLabel: user.name, kind: "role_removed", change: { role: r.name } });
    await recordActivity(tx, { session, action: "access_changed", entityType: "Admin user", entityId: id, entityLabel: user.name, detail: `Roles +${addedRoles.map((r) => r.name).join(", ") || "none"} / -${removedRoles.map((r) => r.name).join(", ") || "none"}`, ip: null });
  });
  return getEmployee(session, id);
}

/* ───────────────────────── permissions & overrides ───────────────────────── */

export async function getEmployeePermissions(session: AuthSession, id: string) {
  authorize(session, "user_permissions", "view");
  const db = getDb();
  const target = await loadAccess(db, id);
  if (!target.user) throw errors.notFound("Employee");
  const [user, overrides] = await Promise.all([
    db.adminUser.findUnique({ where: { id }, select: { id: true, name: true, employeeId: true, status: true } }),
    db.userPermissionOverride.findMany({ where: { userId: id }, include: { permission: true, createdBy: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  const effective: Record<string, { scope: Scope; viaRoles: string[]; individual: boolean }> = {};
  for (const [key, g] of target.potential.grants) effective[key] = { scope: g.scope, viaRoles: g.viaRoles, individual: g.individual };

  // What the roles alone grant, BEFORE individual overrides: the UI needs it to show "granted via role" even for
  // a permission that an override currently denies (so the denial can be lifted).
  const roleRows = await db.role.findMany({ where: { users: { some: { userId: id } } }, include: { permissions: { select: { scope: true, permission: { select: { resource: true, action: true } } } } } });
  const fromRoles = resolveEffective({ accountActive: true, roles: roleRows.map(toRoleInput), overrides: [] });
  const inherited: Record<string, { scope: Scope; viaRoles: string[] }> = {};
  for (const [key, g] of fromRoles.grants) inherited[key] = { scope: g.scope, viaRoles: g.viaRoles };

  // What THIS actor may hand out (drives disabled checkboxes in the UI; the server enforces it again on save).
  const delegable: Record<string, Scope> = {};
  if (session.access.isSuperAdmin) {
    for (const [key] of session.access.grants) delegable[key] = "all";
  } else {
    for (const [key, g] of session.access.grants) delegable[key] = g.scope;
  }
  return {
    user: { ...user!, isSuperAdmin: target.holdsSuperAdminRole },
    roles: target.roles,
    overrides: overrides.map((o) => ({ resource: o.permission.resource, action: o.permission.action, effect: o.effect, scope: o.scope, reason: o.reason, createdAt: o.createdAt.toISOString(), createdBy: o.createdBy?.name ?? null })),
    effective,
    inherited,
    denied: Array.from(target.potential.denied),
    delegable,
    actorCanManage: !session.access.isSuperAdmin ? (target.holdsSuperAdminRole ? false : hasPermission(session.access, "user_permissions", "manage_permissions")) : true,
  };
}

export async function setEmployeeOverrides(session: AuthSession, id: string, input: z.infer<typeof overridesInput>) {
  authorize(session, "user_permissions", "manage_permissions");
  const db = getDb();
  assertNotSelf(session, id, "permissions");
  const target = await loadAccess(db, id);
  const user = await db.adminUser.findUnique({ where: { id }, select: { name: true } });
  if (!user || !target.user) throw errors.notFound("Employee");
  if (target.holdsSuperAdminRole) throw errors.invalid("Individual overrides cannot restrict or extend a Super Admin", { overrides: "Not allowed for a Super Admin" });
  assertManageable(session, target);

  // Validate + normalise: catalogue membership, scope rules, no duplicates.
  const seen = new Set<string>();
  const wanted: { resource: string; action: string; effect: "allow" | "deny"; scope: Scope }[] = [];
  for (const o of input.overrides) {
    if (!isValidPermission(o.resource, o.action)) throw errors.invalid(`Unknown permission ${o.resource}:${o.action}`, { overrides: `Unknown permission ${o.resource}:${o.action}` });
    const key = `${o.resource}:${o.action}`;
    if (seen.has(key)) throw errors.invalid(`Duplicate override for ${key}`, { overrides: `Duplicate override for ${key}` });
    seen.add(key);
    const scopable = !!getResource(o.resource)?.scopable;
    if (o.scope === "assigned" && !scopable) throw errors.invalid(`${o.resource} does not support assigned-only scope`, { overrides: `${o.resource} does not support assigned-only scope` });
    wanted.push({ ...o, scope: o.effect === "deny" ? "all" : o.scope });
  }
  // D5: every ALLOW must be something the actor can hand out. (Denials only restrict, so they need no such check.)
  assertCanGrantAll(session, wanted.filter((o) => o.effect === "allow"));

  const existing = await db.userPermissionOverride.findMany({ where: { userId: id }, include: { permission: true } });
  const keyOf = (r: string, a: string) => `${r}:${a}`;
  const existingMap = new Map(existing.map((e) => [keyOf(e.permission.resource, e.permission.action), e]));
  const wantedMap = new Map(wanted.map((w) => [keyOf(w.resource, w.action), w]));
  const toRemove = existing.filter((e) => !wantedMap.has(keyOf(e.permission.resource, e.permission.action)));
  const toUpsert = wanted.filter((w) => { const e = existingMap.get(keyOf(w.resource, w.action)); return !e || e.effect !== w.effect || e.scope !== w.scope; });
  if (toRemove.length === 0 && toUpsert.length === 0) return getEmployeePermissions(session, id);

  // D4 on the resulting access.
  const roleRows = await db.role.findMany({ where: { users: { some: { userId: id } } }, include: { permissions: { select: { scope: true, permission: { select: { resource: true, action: true } } } } } });
  assertWithinAuthority(session, resolveEffective({ accountActive: true, roles: roleRows.map(toRoleInput), overrides: wanted }));

  const permRows = await db.permission.findMany({ where: { OR: toUpsert.map((w) => ({ resource: w.resource, action: w.action })) } });
  await db.$transaction(async (tx) => {
    if (toRemove.length) await tx.userPermissionOverride.deleteMany({ where: { id: { in: toRemove.map((r) => r.id) } } });
    for (const w of toUpsert) {
      const permissionId = permRows.find((p) => p.resource === w.resource && p.action === w.action)!.id;
      await tx.userPermissionOverride.upsert({
        where: { userId_permissionId: { userId: id, permissionId } },
        update: { effect: w.effect, scope: w.scope, reason: input.reason ?? null, createdById: session.user.id },
        create: { userId: id, permissionId, effect: w.effect, scope: w.scope, reason: input.reason ?? null, createdById: session.user.id },
      });
      await recordAccessChange(tx, { session, targetType: "user", targetId: id, targetLabel: user.name, kind: "override_set", change: { permission: keyOf(w.resource, w.action), effect: w.effect, scope: w.scope, reason: input.reason ?? null } });
    }
    for (const r of toRemove) await recordAccessChange(tx, { session, targetType: "user", targetId: id, targetLabel: user.name, kind: "override_removed", change: { permission: keyOf(r.permission.resource, r.permission.action), was: r.effect } });
    await recordActivity(tx, { session, action: "access_changed", entityType: "Admin user", entityId: id, entityLabel: user.name, detail: `Overrides: ${toUpsert.length} set, ${toRemove.length} removed`, ip: null });
  });
  return getEmployeePermissions(session, id);
}

export async function getPermissionHistory(session: AuthSession, id: string) {
  authorize(session, "user_permissions", "view");
  const rows = await getDb().permissionChangeLog.findMany({ where: { targetType: "user", targetId: id }, orderBy: { createdAt: "desc" }, take: 100 });
  return { items: rows.map((r) => ({ id: r.id, actorName: r.actorName, kind: r.kind, change: r.change, createdAt: r.createdAt.toISOString() })) };
}

export async function getEmployeeActivity(session: AuthSession, id: string) {
  authorize(session, "users", "view");
  authorize(session, "activity_logs", "view");
  const rows = await getDb().activityLog.findMany({ where: { actorId: id }, orderBy: { createdAt: "desc" }, take: 50 });
  return { items: rows.map((a) => ({ id: a.id, action: a.action, entityType: a.entityType, entityLabel: a.entityLabel, detail: a.detail, createdAt: a.createdAt.toISOString() })) };
}

export async function inviteEmployee(session: AuthSession, id: string, request: Request): Promise<InviteResult> {
  authorize(session, "users", "edit");
  const db = getDb();
  const target = await loadAccess(db, id);
  const user = await db.adminUser.findUnique({ where: { id }, select: { id: true, name: true, email: true, status: true, passwordHash: true } });
  if (!user || !target.user) throw errors.notFound("Employee");
  assertNotSelf(session, id, "invitation");
  assertManageable(session, target);
  if (user.status === "suspended") throw errors.conflict("This account is deactivated. Reactivate it before sending a link.");
  // A pending employee gets an invitation; an active one gets a password-reset link.
  return sendAccountLink(request, session, user, user.status === "invited" ? "invite" : "password_reset");
}

/* ───────────────────────── dashboard configuration ───────────────────────── */

type WidgetPref = { key: string; enabled: boolean; order: number };

async function defaultDashboard() {
  const row = await getDb().siteSetting.findUnique({ where: { key: "dashboard_default" } });
  const v = (row?.value ?? null) as { widgets?: string[]; quickActions?: string[] } | null;
  return { widgets: v?.widgets ?? WIDGETS.map((w) => w.key), quickActions: v?.quickActions ?? QUICK_ACTIONS.map((q) => q.key) };
}

/** The dashboard an employee actually gets: saved preference, else the default, always filtered to what they may see. */
export async function resolveDashboard(userId: string, grants: ReadonlyMap<string, unknown>) {
  const db = getDb();
  const pref = await db.userDashboardPreference.findUnique({ where: { userId } });
  const def = await defaultDashboard();
  const allowedWidget = (k: string) => { const w = WIDGET_BY_KEY.get(k); return !!w && grants.has(w.requires); };
  const allowedQuick = (k: string) => { const q = QUICK_ACTION_BY_KEY.get(k); return !!q && grants.has(q.requires); };

  let widgets: WidgetPref[];
  let quickActions: string[];
  if (pref) {
    widgets = (pref.widgets as WidgetPref[]).filter((w) => allowedWidget(w.key));
    quickActions = (pref.quickActions as string[]).filter(allowedQuick);
  } else {
    widgets = def.widgets.filter(allowedWidget).map((key, order) => ({ key, enabled: true, order }));
    quickActions = def.quickActions.filter(allowedQuick);
  }
  return { widgets: widgets.sort((a, b) => a.order - b.order), quickActions, customised: !!pref };
}

export async function getEmployeeDashboard(session: AuthSession, id: string) {
  authorize(session, "user_dashboards", "view");
  const target = await loadAccess(getDb(), id);
  if (!target.user) throw errors.notFound("Employee");
  const resolved = await resolveDashboard(id, target.potential.grants);
  const available = WIDGETS.filter((w) => target.potential.grants.has(w.requires)).map((w) => ({ key: w.key, label: w.label }));
  const availableQuick = QUICK_ACTIONS.filter((q) => target.potential.grants.has(q.requires)).map((q) => ({ key: q.key, label: q.label }));
  // Widgets the employee holds but the saved layout omitted still show up as disabled so they can be switched on.
  const known = new Set(resolved.widgets.map((w) => w.key));
  const widgets = [...resolved.widgets, ...available.filter((a) => !known.has(a.key)).map((a, i) => ({ key: a.key, enabled: false, order: resolved.widgets.length + i }))];
  return { widgets, quickActions: resolved.quickActions, available, availableQuick, customised: resolved.customised };
}

export async function setEmployeeDashboard(session: AuthSession, id: string, input: z.infer<typeof dashboardInput>) {
  authorize(session, "user_dashboards", "edit");
  const db = getDb();
  const target = await loadAccess(db, id);
  const user = await db.adminUser.findUnique({ where: { id }, select: { name: true } });
  if (!user || !target.user) throw errors.notFound("Employee");
  if (session.user.id !== id) assertManageable(session, target);
  // A widget / quick action may only be assigned if the EMPLOYEE is entitled to its underlying data.
  const bad: string[] = [];
  for (const w of input.widgets) {
    const def = WIDGET_BY_KEY.get(w.key);
    if (!def) throw errors.invalid(`Unknown widget ${w.key}`, { widgets: `Unknown widget ${w.key}` });
    if (!parsePermKey(def.requires) || !target.potential.grants.has(def.requires)) bad.push(def.label);
  }
  for (const k of input.quickActions) {
    const def = QUICK_ACTION_BY_KEY.get(k);
    if (!def) throw errors.invalid(`Unknown quick action ${k}`, { quickActions: `Unknown quick action ${k}` });
    if (!target.potential.grants.has(def.requires)) bad.push(def.label);
  }
  if (bad.length) throw errors.invalid(`This employee is not authorised to see: ${bad.join(", ")}`, { widgets: `Not authorised: ${bad.join(", ")}` });
  if (new Set(input.widgets.map((w) => w.key)).size !== input.widgets.length) throw errors.invalid("Duplicate widget", { widgets: "Duplicate widget" });

  await db.$transaction(async (tx) => {
    await tx.userDashboardPreference.upsert({
      where: { userId: id },
      update: { widgets: input.widgets, quickActions: input.quickActions, updatedById: session.user.id },
      create: { userId: id, widgets: input.widgets, quickActions: input.quickActions, updatedById: session.user.id },
    });
    await recordAccessChange(tx, { session, targetType: "user", targetId: id, targetLabel: user.name, kind: "dashboard_changed", change: { widgets: input.widgets.filter((w) => w.enabled).map((w) => w.key), quickActions: input.quickActions } });
    await recordActivity(tx, { session, action: "updated", entityType: "Dashboard configuration", entityId: id, entityLabel: user.name, ip: null });
  });
  return getEmployeeDashboard(session, id);
}

export async function resetEmployeeDashboard(session: AuthSession, id: string) {
  authorize(session, "user_dashboards", "edit");
  const db = getDb();
  const target = await loadAccess(db, id);
  const user = await db.adminUser.findUnique({ where: { id }, select: { name: true } });
  if (!user || !target.user) throw errors.notFound("Employee");
  if (session.user.id !== id) assertManageable(session, target);
  await db.$transaction(async (tx) => {
    await tx.userDashboardPreference.deleteMany({ where: { userId: id } });
    await recordAccessChange(tx, { session, targetType: "user", targetId: id, targetLabel: user.name, kind: "dashboard_changed", change: { reset: true } });
  });
  return getEmployeeDashboard(session, id);
}

/** The signed-in employee's own profile. Needs only a session (not users:view): everyone may see their own account. */
export async function getOwnProfile(session: AuthSession) {
  const db = getDb();
  const row = await db.adminUser.findUnique({ where: { id: session.user.id }, select: employeeSelect });
  if (!row) throw errors.notFound("Employee");
  return toEmployeeDto(row, viewCount(session.access), session.access.isSuperAdmin);
}
