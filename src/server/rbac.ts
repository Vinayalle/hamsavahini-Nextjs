import "server-only";
import { getResource, isValidPermission } from "@/lib/authz/catalog";
import { hasPermission, scopeFor, type Scope } from "@/lib/authz/resolve";
import type { AuthSession } from "./auth";
import { errors } from "./errors";

/**
 * CENTRALISED SERVER-SIDE AUTHORIZATION. Every protected handler and service goes through these functions;
 * no page, component or route computes permissions on its own. The policy itself lives in
 * `src/lib/authz/resolve.ts` (documented in docs/rbac-architecture.md).
 */

function assertCatalogued(resource: string, action: string) {
  // A typo here is a programming error, not a user error: fail loudly instead of silently denying/allowing.
  if (!isValidPermission(resource, action)) throw new Error(`Unknown permission ${resource}:${action}. Add it to src/lib/authz/catalog.ts`);
}

/** Does the user hold the permission (at any scope)? */
export function can(session: AuthSession, resource: string, action: string): boolean {
  return hasPermission(session.access, resource, action);
}

/** The scope the user holds for the permission, or null. */
export function scopeOf(session: AuthSession, resource: string, action: string): Scope | null {
  return scopeFor(session.access, resource, action);
}

/** Throws 403 unless the user holds `resource:action` (the resolver already requires `view` for any other action). */
export function authorize(session: AuthSession, resource: string, action: string): void {
  assertCatalogued(resource, action);
  if (!can(session, resource, action)) throw errors.forbidden();
}

/** At least one of the actions is required (used by bulk endpoints before the body says which one). */
export function authorizeAny(session: AuthSession, resource: string, actions: string[]): void {
  actions.forEach((a) => assertCatalogued(resource, a));
  if (!actions.some((a) => can(session, resource, a))) throw errors.forbidden();
}

/**
 * Which status-changing action does moving a record from `from` to `to` need?
 * published/open -> publish, leaving published -> unpublish, to archived/closed -> archive, out of archived -> restore.
 */
export function statusAction(from: string | null, to: string): "publish" | "unpublish" | "archive" | "restore" | "edit" {
  if (to === from) return "edit";
  if (to === "published" || to === "open") return "publish";
  if (to === "archived" || to === "closed") return "archive";
  if (from === "archived" || from === "closed") return "restore";
  if (from === "published" || from === "open") return "unpublish";
  return "edit";
}

/** Authorizes a status change using the per-action rules above (resource must support that action). */
export function authorizeStatusChange(session: AuthSession, resource: string, from: string | null, to: string): void {
  if (to === from) return;
  const action = statusAction(from, to);
  if (action === "edit" && from === null) return; // creating a record in a plain state needs only `create`
  const supported = (getResource(resource)?.actions as readonly string[] | undefined)?.includes(action);
  authorize(session, resource, supported ? action : "edit");
}

/* ───────────── record-level scope (assignment-based restrictions) ───────────── */

/**
 * For list queries: `undefined` = no restriction, otherwise a Prisma-style filter limiting rows to those
 * assigned to the user. Throws 403 if the user does not hold the permission at all.
 */
export function assignedFilter(session: AuthSession, resource: string, action: string): { assignedToId: string } | undefined {
  authorize(session, resource, action);
  return scopeOf(session, resource, action) === "assigned" ? { assignedToId: session.user.id } : undefined;
}

/** For single-record operations. Unauthorized and out-of-scope both return 404 so existence is not leaked. */
export function authorizeRecord(session: AuthSession, resource: string, action: string, record: { assignedToId: string | null }): void {
  authorize(session, resource, action);
  if (scopeOf(session, resource, action) === "assigned" && record.assignedToId !== session.user.id) throw errors.notFound();
}

/**
 * Bulk status change: the rows' current states differ, so authorize by the TARGET state
 * (published -> publish, archived -> archive, anything else -> unpublish) in addition to `edit`.
 */
export function authorizeBulkStatus(session: AuthSession, resource: string, to: string): void {
  authorize(session, resource, "edit");
  const action = to === "published" || to === "open" ? "publish" : to === "archived" || to === "closed" ? "archive" : "unpublish";
  const supported = (getResource(resource)?.actions as readonly string[] | undefined)?.includes(action);
  authorize(session, resource, supported ? action : "edit");
}
