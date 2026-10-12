import { ALL_PERMISSIONS, getResource, isValidPermission, parsePermKey, permKey, type PermissionKey } from "./catalog";

/**
 * PERMISSION RESOLUTION POLICY (the one and only implementation; documented in docs/rbac-architecture.md)
 *
 *  1. An account that is not `active` has NO permissions, whatever roles it holds.
 *  2. A user holding an active role flagged Super Admin has EVERY permission, with scope "all".
 *     Overrides cannot restrict a Super Admin (the last-super-admin safeguards protect the account itself).
 *  3. Otherwise the grants of all ACTIVE assigned roles are united (multiple roles combine additively).
 *     If the same permission arrives with different scopes, the broadest wins (all > assigned).
 *  4. Individual overrides are then applied:
 *       - an "allow" override adds a grant (marked individual);
 *       - a "deny" override REMOVES the permission. Deny always wins over role grants AND over an allow override.
 *  5. `view` is the gate for a resource: any other action on a resource is only effective if `view` on that
 *     resource is also effective (a user cannot edit what they cannot see).
 *  6. Scope "assigned" (record-level) is only meaningful for scopable resources; elsewhere it is treated as "all".
 *  7. Permissions that are not in the catalogue are ignored.
 */

export type Scope = "all" | "assigned";
const scopeRank: Record<Scope, number> = { assigned: 1, all: 2 };
export const scopeCovers = (have: Scope, want: Scope) => scopeRank[have] >= scopeRank[want];
export const broader = (a: Scope, b: Scope): Scope => (scopeRank[a] >= scopeRank[b] ? a : b);

export interface RoleInput {
  id: string;
  name: string;
  active: boolean;
  isSuperAdmin: boolean;
  grants: { resource: string; action: string; scope: Scope }[];
}
export interface OverrideInput {
  resource: string;
  action: string;
  effect: "allow" | "deny";
  scope: Scope;
}

export interface Grant {
  scope: Scope;
  /** Names of the roles that grant it. */
  viaRoles: string[];
  /** True if (also) granted by an individual allow override. */
  individual: boolean;
}

export interface EffectiveAccess {
  accountActive: boolean;
  isSuperAdmin: boolean;
  grants: ReadonlyMap<PermissionKey, Grant>;
  /** Explicit individual denials that removed a permission that would otherwise exist. */
  denied: ReadonlySet<PermissionKey>;
}

export const NO_ACCESS: EffectiveAccess = { accountActive: false, isSuperAdmin: false, grants: new Map(), denied: new Set() };

export function resolveEffective(input: { accountActive: boolean; roles: RoleInput[]; overrides: OverrideInput[] }): EffectiveAccess {
  if (!input.accountActive) return NO_ACCESS; // rule 1

  const activeRoles = input.roles.filter((r) => r.active);

  if (activeRoles.some((r) => r.isSuperAdmin)) {
    // rule 2
    const all = new Map<PermissionKey, Grant>();
    for (const p of ALL_PERMISSIONS) all.set(permKey(p.resource, p.action), { scope: "all", viaRoles: activeRoles.filter((r) => r.isSuperAdmin).map((r) => r.name), individual: false });
    return { accountActive: true, isSuperAdmin: true, grants: all, denied: new Set() };
  }

  const grants = new Map<PermissionKey, Grant>();
  const effScope = (resource: string, scope: Scope): Scope => (getResource(resource)?.scopable ? scope : "all"); // rule 6

  // rule 3
  for (const role of activeRoles) {
    for (const g of role.grants) {
      if (!isValidPermission(g.resource, g.action)) continue; // rule 7
      const key = permKey(g.resource, g.action);
      const scope = effScope(g.resource, g.scope);
      const cur = grants.get(key);
      if (cur) {
        cur.scope = broader(cur.scope, scope);
        if (!cur.viaRoles.includes(role.name)) cur.viaRoles.push(role.name);
      } else grants.set(key, { scope, viaRoles: [role.name], individual: false });
    }
  }

  // rule 4: allow overrides first, then denials (so deny wins over everything)
  const denied = new Set<PermissionKey>();
  for (const o of input.overrides) {
    if (o.effect !== "allow" || !isValidPermission(o.resource, o.action)) continue;
    const key = permKey(o.resource, o.action);
    const scope = effScope(o.resource, o.scope);
    const cur = grants.get(key);
    if (cur) {
      cur.scope = broader(cur.scope, scope);
      cur.individual = true;
    } else grants.set(key, { scope, viaRoles: [], individual: true });
  }
  for (const o of input.overrides) {
    if (o.effect !== "deny" || !isValidPermission(o.resource, o.action)) continue;
    const key = permKey(o.resource, o.action);
    grants.delete(key);
    denied.add(key); // recorded even if nothing granted it yet, so the UI can show the explicit restriction
  }

  // rule 5: no action without view on the same resource
  for (const key of Array.from(grants.keys())) {
    const p = parsePermKey(key)!;
    if (p.action !== "view" && !grants.has(permKey(p.resource, "view"))) grants.delete(key);
  }

  return { accountActive: true, isSuperAdmin: false, grants, denied };
}

export function hasPermission(access: EffectiveAccess, resource: string, action: string, needScope: Scope = "assigned"): boolean {
  const g = access.grants.get(permKey(resource, action));
  return !!g && scopeCovers(g.scope, needScope);
}

/** The scope the user holds for a permission, or null if they do not hold it. */
export function scopeFor(access: EffectiveAccess, resource: string, action: string): Scope | null {
  return access.grants.get(permKey(resource, action))?.scope ?? null;
}

/**
 * Delegation: can `actor` hand out (resource, action, scope)? Only permissions the actor effectively holds,
 * at an equal or broader scope. (Holding the *capability* to delegate at all, e.g. users:manage_permissions,
 * is a separate check made by the caller.)
 */
export function canGrant(actor: EffectiveAccess, resource: string, action: string, scope: Scope = "all"): boolean {
  if (!actor.accountActive || !isValidPermission(resource, action)) return false;
  if (actor.isSuperAdmin) return true;
  return hasPermission(actor, resource, action, scope);
}

/** Every permission in `target` is also held by `actor` at an equal or broader scope. */
export function covers(actor: EffectiveAccess, target: EffectiveAccess): boolean {
  if (actor.isSuperAdmin) return true;
  if (target.isSuperAdmin) return false;
  for (const [key, g] of target.grants) {
    const mine = actor.grants.get(key);
    if (!mine || !scopeCovers(mine.scope, g.scope)) return false;
  }
  return true;
}

/** Same set of permissions at the same scopes (used for the before/after comparison and "no change" checks). */
export function diffAccess(before: EffectiveAccess, after: EffectiveAccess) {
  const added: PermissionKey[] = [];
  const removed: PermissionKey[] = [];
  const changedScope: PermissionKey[] = [];
  for (const [k, g] of after.grants) {
    const b = before.grants.get(k);
    if (!b) added.push(k);
    else if (b.scope !== g.scope) changedScope.push(k);
  }
  for (const k of before.grants.keys()) if (!after.grants.has(k)) removed.push(k);
  return { added: added.sort(), removed: removed.sort(), changedScope: changedScope.sort() };
}

/** Pure helper for the UI: how a single permission is presented for one employee. */
export type PermissionState =
  | { state: "role"; roles: string[]; scope: Scope }
  | { state: "individual"; scope: Scope; alsoRoles: string[] }
  | { state: "denied" }
  | { state: "none" };

export function stateOf(access: EffectiveAccess, resource: string, action: string): PermissionState {
  const key = permKey(resource, action);
  const g = access.grants.get(key);
  if (g) return g.individual && g.viaRoles.length === 0 ? { state: "individual", scope: g.scope, alsoRoles: [] } : g.individual ? { state: "individual", scope: g.scope, alsoRoles: g.viaRoles } : { state: "role", roles: g.viaRoles, scope: g.scope };
  if (access.denied.has(key)) return { state: "denied" };
  return { state: "none" };
}
