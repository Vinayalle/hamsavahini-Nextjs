import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { canGrant, covers, type EffectiveAccess, type Scope } from "@/lib/authz/resolve";
import type { AuthSession } from "../auth";
import { errors } from "../errors";
import { loadAccess, SUPER_ADMIN_CODE, type LoadedAccess } from "./access";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * DELEGATION RULES (documented in docs/rbac-architecture.md)
 *
 *  D1. Nobody changes their OWN roles, overrides or account status (no self-elevation, no self-lockout).
 *  D2. Only a Super Admin may touch a Super Admin account or hand out the Super Admin role.
 *  D3. An actor may only manage an employee whose CURRENT effective permissions are within the actor's own.
 *  D4. An actor may only produce an employee whose RESULTING effective permissions are within the actor's own,
 *      whichever path is used (role assignment, individual override, new employee). This is checked on the
 *      resulting access, so it cannot be bypassed by combining several small changes.
 *  D5. An actor may only grant a permission (to a role or an individual) that they hold, at an equal or broader scope.
 *  D6. The last active Super Admin can never be deactivated or stripped of the role.
 *  The capability to delegate at all (users:assign, user_permissions:manage_permissions, roles:manage_permissions ...)
 *  is checked separately by the caller with `authorize()`.
 */

export function assertNotSelf(actor: AuthSession, targetUserId: string, what: string) {
  if (actor.user.id === targetUserId) throw errors.delegation(`You cannot change your own ${what}.`);
}

/** D2 + D3. */
export function assertManageable(actor: AuthSession, target: LoadedAccess) {
  // Judge the target by what it WOULD hold if active, so a deactivated Super Admin is still protected.
  if (target.holdsSuperAdminRole && !actor.access.isSuperAdmin) throw errors.delegation("Only a Super Admin can manage a Super Admin account.");
  if (!covers(actor.access, target.potential)) throw errors.delegation("This employee has permissions beyond your own, so you cannot manage them.");
}

/** D4. */
export function assertWithinAuthority(actor: AuthSession, proposed: EffectiveAccess) {
  if (!covers(actor.access, proposed)) throw errors.delegation("This change would give the employee permissions beyond your own authority.");
}

/** D5, for a list of grants. Reports every offending permission to the caller. */
export function assertCanGrantAll(actor: AuthSession, grants: { resource: string; action: string; scope: Scope }[]) {
  const bad = grants.filter((g) => !canGrant(actor.access, g.resource, g.action, g.scope)).map((g) => `${g.resource}:${g.action}`);
  if (bad.length) throw errors.delegation(`You cannot grant permissions you do not hold: ${bad.slice(0, 6).join(", ")}${bad.length > 6 ? ` and ${bad.length - 6} more` : ""}.`);
}

export interface RoleForAssignment {
  id: string;
  name: string;
  code: string;
  status: "active" | "inactive";
  permissions: { scope: Scope; permission: { resource: string; action: string } }[];
}

/** D2 + D5 for role assignment. */
export function assertRolesAssignable(actor: AuthSession, roles: RoleForAssignment[]) {
  for (const role of roles) {
    if (role.status !== "active") throw errors.invalid(`Role “${role.name}” is inactive and cannot be assigned`, { roleIds: `Role “${role.name}” is inactive` });
    if (role.code === SUPER_ADMIN_CODE && !actor.access.isSuperAdmin) throw errors.delegation("Only a Super Admin can assign the Super Admin role.");
    if (role.code !== SUPER_ADMIN_CODE) {
      assertCanGrantAll(actor, role.permissions.map((g) => ({ resource: g.permission.resource, action: g.permission.action, scope: g.scope })));
    }
  }
}

/** Number of ACTIVE users that currently hold an ACTIVE Super Admin role. */
export async function countActiveSuperAdmins(db: Db, excludeUserId?: string): Promise<number> {
  return db.adminUser.count({
    where: {
      status: "active",
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      roles: { some: { role: { code: SUPER_ADMIN_CODE, status: "active" } } },
    },
  });
}

/**
 * D6: throw if `userId` is the last active Super Admin. MUST be called inside the transaction that performs the
 * change: it locks every active Super Admin row (SELECT ... FOR UPDATE), so two concurrent requests that would
 * each leave the other as "the remaining one" are serialised and the second one is refused.
 */
export async function assertNotLastSuperAdmin(tx: Prisma.TransactionClient, userId: string, action: string) {
  // Lock all active Super Admin accounts (stable id order avoids deadlocks between concurrent callers).
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT u."id" FROM "AdminUser" u
    WHERE u."status" = 'active' AND EXISTS (
      SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r."id" = ur."roleId"
      WHERE ur."userId" = u."id" AND r."code" = ${SUPER_ADMIN_CODE} AND r."status" = 'active')
    ORDER BY u."id" FOR UPDATE`;
  const isSuper = locked.some((r) => r.id === userId);
  if (!isSuper) return; // only an ACTIVE super admin counts towards the safeguard
  if (locked.filter((r) => r.id !== userId).length === 0) {
    throw errors.conflict(`You cannot ${action} the last active Super Admin. Create or activate another Super Admin first.`);
  }
}

export { loadAccess };
