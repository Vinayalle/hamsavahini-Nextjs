import type { PrismaClient } from "../../generated/prisma/client";
import { ALL_PERMISSIONS } from "./catalog";
import { DEFAULT_ROLES } from "./default-roles";

/**
 * Idempotent, non-destructive provisioning shared by the seed script and the tests. No server-only imports so
 * it can run under `tsx`.
 */

/** Make the Permission table match the catalogue: add missing rows, refresh `module`. Never deletes a row. */
export async function syncPermissionCatalogue(db: PrismaClient): Promise<number> {
  for (const p of ALL_PERMISSIONS) {
    await db.permission.upsert({
      where: { resource_action: { resource: p.resource, action: p.action } },
      update: { module: p.module },
      create: { resource: p.resource, action: p.action, module: p.module },
    });
  }
  return ALL_PERMISSIONS.length;
}

/**
 * Create the default roles that do not exist yet (matched by code).
 * Existing roles are NOT modified, except the Super Admin role which is kept complete.
 * Returns the ids by code.
 */
export async function ensureDefaultRoles(db: PrismaClient): Promise<Record<string, string>> {
  const perms = await db.permission.findMany();
  const permId = new Map(perms.map((p) => [`${p.resource}:${p.action}`, p.id]));
  const ids: Record<string, string> = {};

  for (const def of DEFAULT_ROLES) {
    let role = await db.role.findUnique({ where: { code: def.code } });
    const isNew = !role;
    if (!role) {
      // A role with the same display name but a different code would violate the unique name: treat as existing.
      role = (await db.role.findUnique({ where: { name: def.name } })) ?? (await db.role.create({ data: { code: def.code, name: def.name, description: def.description, isSystem: def.isSystem } }));
    }
    ids[def.code] = role.id;
    if (isNew || def.code === "super_admin") {
      const rows = def.grants.flatMap((g) => {
        const id = permId.get(`${g.resource}:${g.action}`);
        return id ? [{ roleId: role.id, permissionId: id, scope: g.scope ?? "all" }] : [];
      });
      if (def.code === "super_admin") await db.rolePermission.deleteMany({ where: { roleId: role.id } });
      await db.rolePermission.createMany({ data: rows, skipDuplicates: true });
    }
  }
  return ids;
}

/** Next human employee number, e.g. EMP-0007. Callers should retry on a unique-violation (concurrent creates). */
export async function nextEmployeeId(db: Pick<PrismaClient, "adminUser">): Promise<string> {
  const rows = await db.adminUser.findMany({ select: { employeeId: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number(r.employeeId.replace(/\D/g, "")) || 0), 0);
  return `EMP-${String(max + 1).padStart(4, "0")}`;
}
