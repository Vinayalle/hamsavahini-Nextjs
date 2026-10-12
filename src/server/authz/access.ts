import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { NO_ACCESS, resolveEffective, type EffectiveAccess, type OverrideInput, type RoleInput } from "@/lib/authz/resolve";

type Db = PrismaClient | Prisma.TransactionClient;

export interface RoleSummary {
  id: string;
  name: string;
  code: string;
  status: "active" | "inactive";
}

export interface LoadedAccess {
  /** The account may sign in and use the system right now (status = active). */
  accessible: boolean;
  user: { id: string; status: "active" | "invited" | "suspended" } | null;
  roles: RoleSummary[];
  /** What the account can do RIGHT NOW. Empty for deactivated / pending accounts. */
  access: EffectiveAccess;
  /**
   * What the account WOULD be able to do if it were active. Delegation checks use this, so an administrator can
   * never manage or reactivate someone more privileged than themselves just because the account is currently off.
   */
  potential: EffectiveAccess;
  /** Holds an active Super Admin role, regardless of account status. */
  holdsSuperAdminRole: boolean;
}

const SUPER_ADMIN_CODE = "super_admin";

const userSelect = {
  id: true,
  status: true,
  roles: { select: { role: { select: { id: true, name: true, code: true, status: true, permissions: { select: { scope: true, permission: { select: { resource: true, action: true } } } } } } } },
  overrides: { select: { effect: true, scope: true, permission: { select: { resource: true, action: true } } } },
} satisfies Prisma.AdminUserSelect;
type UserRow = Prisma.AdminUserGetPayload<{ select: typeof userSelect }>;

function build(user: UserRow): LoadedAccess {
  const roleInputs: RoleInput[] = user.roles.map(({ role }) => ({
    id: role.id,
    name: role.name,
    active: role.status === "active",
    isSuperAdmin: role.code === SUPER_ADMIN_CODE,
    grants: role.permissions.map((g) => ({ resource: g.permission.resource, action: g.permission.action, scope: g.scope })),
  }));
  const overrides: OverrideInput[] = user.overrides.map((o) => ({ resource: o.permission.resource, action: o.permission.action, effect: o.effect, scope: o.scope }));
  const potential = resolveEffective({ accountActive: true, roles: roleInputs, overrides });
  const accessible = user.status === "active";
  return {
    accessible,
    user: { id: user.id, status: user.status },
    roles: user.roles.map(({ role }) => ({ id: role.id, name: role.name, code: role.code, status: role.status })),
    access: accessible ? potential : NO_ACCESS,
    potential,
    holdsSuperAdminRole: potential.isSuperAdmin,
  };
}

/**
 * Loads a user's CURRENT roles and overrides from the database and resolves their effective permissions
 * with the shared policy in `src/lib/authz/resolve.ts`. This is the only place permissions are computed
 * on the server; it is called on every authenticated request so revocation is immediate.
 */
export async function loadAccess(db: Db, userId: string): Promise<LoadedAccess> {
  const user = await db.adminUser.findUnique({ where: { id: userId }, select: userSelect });
  if (!user) return { accessible: false, user: null, roles: [], access: NO_ACCESS, potential: NO_ACCESS, holdsSuperAdminRole: false };
  return build(user);
}

/** Resolves many users at once (list pages) without one round trip per user. */
export async function loadAccessMany(db: Db, userIds: string[]): Promise<Map<string, LoadedAccess>> {
  const out = new Map<string, LoadedAccess>();
  if (userIds.length === 0) return out;
  const users = await db.adminUser.findMany({ where: { id: { in: userIds } }, select: userSelect });
  for (const user of users) out.set(user.id, build(user));
  return out;
}

export { SUPER_ADMIN_CODE };
