import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getResource, isValidPermission } from "@/lib/authz/catalog";
import { canGrant, type Scope } from "@/lib/authz/resolve";
import { getDb } from "../db";
import { recordActivity } from "../audit";
import type { AuthSession } from "../auth";
import { errors } from "../errors";
import { authorize } from "../rbac";
import { SUPER_ADMIN_CODE } from "../authz/access";
import { assertCanGrantAll } from "../authz/delegation";
import { recordAccessChange } from "../authz/history";
import { setEmployeeRoles } from "./users";

const code = z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{2,39}$/, "Use 3-40 lowercase letters, numbers or underscores, starting with a letter");
const grant = z.object({ resource: z.string(), action: z.string(), scope: z.enum(["all", "assigned"]).default("all") });
export type GrantInput = z.infer<typeof grant>;

export const roleCreate = z.object({
  name: z.string().trim().min(2, "Role name is required").max(60),
  code: code.optional(),
  description: z.string().trim().min(5, "Add a short description").max(300),
  grants: z.array(grant).max(400).default([]),
});
export const rolePatch = z.object({ name: z.string().trim().min(2).max(60), description: z.string().trim().min(5).max(300) }).partial();
export const roleGrantsInput = z.object({ grants: z.array(grant).max(400) });
export const roleStatusInput = z.object({ status: z.enum(["active", "inactive"]) });
export const roleDuplicateInput = z.object({ name: z.string().trim().min(2).max(60) });
export const roleUsersInput = z.object({ add: z.array(z.uuid()).max(100).default([]), remove: z.array(z.uuid()).max(100).default([]) });
export const roleListQuery = z.object({
  search: z.string().trim().max(60).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  system: z.enum(["true", "false"]).optional(),
});

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^([0-9])/, "r_$1").slice(0, 40);

const roleInclude = {
  _count: { select: { users: true, permissions: true } },
} satisfies Prisma.RoleInclude;
type RoleRow = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;

export function toRoleDto(r: RoleRow) {
  return {
    id: r.id, name: r.name, code: r.code, description: r.description, isSystem: r.isSystem, status: r.status,
    readOnly: r.code === SUPER_ADMIN_CODE, userCount: r._count.users, permissionCount: r._count.permissions,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

/** Validates a grant list against the catalogue and the scope rules; returns it de-duplicated. */
function normaliseGrants(grants: GrantInput[]): { resource: string; action: string; scope: Scope }[] {
  const seen = new Set<string>();
  const out: { resource: string; action: string; scope: Scope }[] = [];
  for (const g of grants) {
    if (!isValidPermission(g.resource, g.action)) throw errors.invalid(`Unknown permission ${g.resource}:${g.action}`, { grants: `Unknown permission ${g.resource}:${g.action}` });
    const key = `${g.resource}:${g.action}`;
    if (seen.has(key)) throw errors.invalid(`Duplicate permission ${key}`, { grants: `Duplicate permission ${key}` });
    seen.add(key);
    if (g.scope === "assigned" && !getResource(g.resource)?.scopable) throw errors.invalid(`${g.resource} does not support assigned-only scope`, { grants: `${g.resource} does not support assigned-only scope` });
    out.push({ resource: g.resource, action: g.action, scope: g.scope });
  }
  // `view` is the gate: refuse a role that edits what it cannot see, instead of silently ignoring those grants.
  const viewable = new Set(out.filter((g) => g.action === "view").map((g) => g.resource));
  const orphan = Array.from(new Set(out.filter((g) => g.action !== "view" && !viewable.has(g.resource)).map((g) => g.resource)));
  if (orphan.length) throw errors.invalid(`Add “View” for: ${orphan.join(", ")}. Other actions need view access.`, { grants: `Add “View” for: ${orphan.join(", ")}` });
  return out;
}

async function loadRole(id: string) {
  const role = await getDb().role.findUnique({ where: { id }, include: roleInclude });
  if (!role) throw errors.notFound("Role");
  return role;
}

/* ───────────────────────── queries ───────────────────────── */

export async function listRoles(session: AuthSession, q: z.infer<typeof roleListQuery>) {
  authorize(session, "roles", "view");
  const rows = await getDb().role.findMany({
    where: {
      ...(q.status ? { status: q.status } : {}),
      ...(q.system ? { isSystem: q.system === "true" } : {}),
      ...(q.search ? { OR: [{ name: { contains: q.search, mode: "insensitive" } }, { description: { contains: q.search, mode: "insensitive" } }] } : {}),
    },
    include: roleInclude,
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  return { items: rows.map(toRoleDto), total: rows.length };
}

export async function getRole(session: AuthSession, id: string) {
  authorize(session, "roles", "view");
  const db = getDb();
  const role = await loadRole(id);
  const [grants, users] = await Promise.all([
    db.rolePermission.findMany({ where: { roleId: id }, include: { permission: true } }),
    db.adminUser.findMany({ where: { roles: { some: { roleId: id } } }, select: { id: true, name: true, employeeId: true, status: true, department: true }, orderBy: { name: "asc" } }),
  ]);
  // What THIS actor may hand out (drives the permission tree; the server enforces it again on save).
  const delegable: Record<string, Scope> = {};
  for (const [key, g] of session.access.grants) delegable[key] = g.scope;
  return {
    ...toRoleDto(role),
    grants: grants.map((g) => ({ resource: g.permission.resource, action: g.permission.action, scope: g.scope })),
    users,
    delegable,
    actorIsSuperAdmin: session.access.isSuperAdmin,
  };
}

/* ───────────────────────── mutations ───────────────────────── */

export async function createRole(session: AuthSession, input: z.infer<typeof roleCreate>) {
  authorize(session, "roles", "create");
  const db = getDb();
  const grants = normaliseGrants(input.grants);
  if (grants.length) {
    authorize(session, "roles", "manage_permissions");
    assertCanGrantAll(session, grants);
  }
  const roleCode = input.code ?? slugify(input.name);
  if (roleCode === SUPER_ADMIN_CODE) throw errors.invalid("That role code is reserved", { code: "That role code is reserved" });
  if (await db.role.findUnique({ where: { name: input.name }, select: { id: true } })) throw errors.conflict("A role with this name already exists", { name: "A role with this name already exists" });
  if (await db.role.findUnique({ where: { code: roleCode }, select: { id: true } })) throw errors.conflict("A role with this code already exists", { code: "A role with this code already exists" });
  const perms = await db.permission.findMany();
  const id = await db.$transaction(async (tx) => {
    const role = await tx.role.create({ data: { name: input.name, code: roleCode, description: input.description, isSystem: false } });
    if (grants.length) await tx.rolePermission.createMany({ data: grants.map((g) => ({ roleId: role.id, permissionId: perms.find((p) => p.resource === g.resource && p.action === g.action)!.id, scope: g.scope })) });
    await recordActivity(tx, { session, action: "created", entityType: "Role", entityId: role.id, entityLabel: role.name, ip: null });
    await recordAccessChange(tx, { session, targetType: "role", targetId: role.id, targetLabel: role.name, kind: "role_created", change: { code: role.code, permissions: grants.length } });
    return role.id;
  });
  return getRole(session, id);
}

export async function updateRole(session: AuthSession, id: string, patch: z.infer<typeof rolePatch>) {
  authorize(session, "roles", "edit");
  const db = getDb();
  const role = await loadRole(id);
  if (role.code === SUPER_ADMIN_CODE) throw errors.delegation("The Super Admin role is read-only.");
  if (patch.name && patch.name !== role.name && (await db.role.findUnique({ where: { name: patch.name }, select: { id: true } }))) throw errors.conflict("A role with this name already exists", { name: "A role with this name already exists" });
  await db.$transaction(async (tx) => {
    await tx.role.update({ where: { id }, data: patch });
    await recordActivity(tx, { session, action: "updated", entityType: "Role", entityId: id, entityLabel: patch.name ?? role.name, detail: `Fields: ${Object.keys(patch).join(", ")}`, ip: null });
  });
  return getRole(session, id);
}

export async function setRoleGrants(session: AuthSession, id: string, input: z.infer<typeof roleGrantsInput>) {
  authorize(session, "roles", "manage_permissions");
  const db = getDb();
  const role = await loadRole(id);
  if (role.code === SUPER_ADMIN_CODE) throw errors.delegation("The Super Admin role is read-only.");
  const wanted = normaliseGrants(input.grants);
  const existing = await db.rolePermission.findMany({ where: { roleId: id }, include: { permission: true } });
  const key = (r: string, a: string) => `${r}:${a}`;
  const cur = new Map(existing.map((e) => [key(e.permission.resource, e.permission.action), e]));
  const want = new Map(wanted.map((w) => [key(w.resource, w.action), w]));
  const added = wanted.filter((w) => !cur.has(key(w.resource, w.action)) || cur.get(key(w.resource, w.action))!.scope !== w.scope);
  const removed = existing.filter((e) => !want.has(key(e.permission.resource, e.permission.action)) || want.get(key(e.permission.resource, e.permission.action))!.scope !== e.scope);
  if (added.length === 0 && removed.length === 0) return getRole(session, id);

  // D5 both ways: you may neither give nor take away what you could not give yourself.
  assertCanGrantAll(session, added);
  const cannotRemove = removed.filter((e) => !canGrant(session.access, e.permission.resource, e.permission.action, e.scope)).map((e) => key(e.permission.resource, e.permission.action));
  if (cannotRemove.length) throw errors.delegation(`You cannot change permissions you do not hold: ${cannotRemove.slice(0, 6).join(", ")}.`);

  const perms = await db.permission.findMany();
  const affected = await db.userRole.count({ where: { roleId: id } });
  await db.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    await tx.rolePermission.createMany({ data: wanted.map((g) => ({ roleId: id, permissionId: perms.find((p) => p.resource === g.resource && p.action === g.action)!.id, scope: g.scope })) });
    await tx.role.update({ where: { id }, data: {} }); // bump updatedAt
    await recordAccessChange(tx, {
      session, targetType: "role", targetId: id, targetLabel: role.name, kind: "role_permissions_changed",
      change: { added: added.map((g) => `${key(g.resource, g.action)}${g.scope === "assigned" ? " (assigned)" : ""}`), removed: removed.map((e) => key(e.permission.resource, e.permission.action)), affectedEmployees: affected },
    });
    await recordActivity(tx, { session, action: "access_changed", entityType: "Role", entityId: id, entityLabel: role.name, detail: `+${added.length} / -${removed.length} permissions, ${affected} employee(s) affected`, ip: null });
  });
  return { ...(await getRole(session, id)), affectedEmployees: affected };
}

export async function setRoleStatus(session: AuthSession, id: string, status: "active" | "inactive") {
  authorize(session, "roles", "change_status");
  const db = getDb();
  const role = await loadRole(id);
  if (role.code === SUPER_ADMIN_CODE) throw errors.delegation("The Super Admin role cannot be deactivated.");
  if (role.status === status) return getRole(session, id);
  await db.$transaction(async (tx) => {
    await tx.role.update({ where: { id }, data: { status } });
    await recordAccessChange(tx, { session, targetType: "role", targetId: id, targetLabel: role.name, kind: "role_status_changed", change: { from: role.status, to: status, affectedEmployees: role._count.users } });
    await recordActivity(tx, { session, action: "status_changed", entityType: "Role", entityId: id, entityLabel: role.name, detail: `Status -> ${status} (${role._count.users} employee(s))`, ip: null });
  });
  return { ...(await getRole(session, id)), affectedEmployees: role._count.users };
}

export async function deleteRole(session: AuthSession, id: string) {
  authorize(session, "roles", "delete");
  const db = getDb();
  const role = await loadRole(id);
  if (role.isSystem) throw errors.conflict("System roles cannot be deleted. You can deactivate a role instead.");
  if (role._count.users > 0) throw errors.conflict(`${role._count.users} employee${role._count.users > 1 ? "s are" : " is"} still assigned to this role. Reassign them first, or deactivate the role.`);
  await db.$transaction(async (tx) => {
    await tx.role.delete({ where: { id } });
    await recordAccessChange(tx, { session, targetType: "role", targetId: id, targetLabel: role.name, kind: "role_deleted", change: { code: role.code } });
    await recordActivity(tx, { session, action: "deleted", entityType: "Role", entityId: id, entityLabel: role.name, ip: null });
  });
}

export async function duplicateRole(session: AuthSession, id: string, input: z.infer<typeof roleDuplicateInput>) {
  authorize(session, "roles", "create");
  authorize(session, "roles", "manage_permissions");
  const db = getDb();
  const source = await loadRole(id);
  const grants = (await db.rolePermission.findMany({ where: { roleId: id }, include: { permission: true } })).map((g) => ({ resource: g.permission.resource, action: g.permission.action, scope: g.scope as Scope }));
  // Copying the Super Admin role would create a second full-access role: only a Super Admin may do that.
  if (source.code === SUPER_ADMIN_CODE && !session.access.isSuperAdmin) throw errors.delegation("Only a Super Admin can duplicate the Super Admin role.");
  assertCanGrantAll(session, grants);
  return createRole(session, { name: input.name, description: `${source.description} (copy)`.slice(0, 300), grants, code: undefined });
}

export async function updateRoleEmployees(session: AuthSession, id: string, input: z.infer<typeof roleUsersInput>) {
  authorize(session, "roles", "assign");
  authorize(session, "users", "assign");
  const db = getDb();
  const role = await loadRole(id);
  const results: { userId: string; ok: boolean; error?: string }[] = [];
  const run = async (userId: string, add: boolean) => {
    try {
      const roleIds = (await db.userRole.findMany({ where: { userId }, select: { roleId: true } })).map((r) => r.roleId);
      const next = add ? Array.from(new Set([...roleIds, id])) : roleIds.filter((r) => r !== id);
      await setEmployeeRoles(session, userId, next);
      results.push({ userId, ok: true });
    } catch (e) {
      results.push({ userId, ok: false, error: e instanceof Error ? e.message : "Failed" });
    }
  };
  for (const u of input.add) await run(u, true);
  for (const u of input.remove) await run(u, false);
  return { role: role.name, results };
}
