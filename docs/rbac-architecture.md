# Role-based access control (RBAC) architecture

Authentication (who you are) is in [authentication.md](authentication.md). This document is about **authorization**: what an authenticated employee may do. In `api` mode it is enforced **on the server for every request**; hiding sidebar links or buttons is cosmetic only.

## Concepts

| Concept | Where | Notes |
|---|---|---|
| Employee (`AdminUser`) | `prisma/schema.prisma` | status `invited / active / suspended`; `employeeId` (`EMP-0001`…); department, designation, reporting manager |
| Role | `Role`, `RolePermission` | reusable permission set; system roles (`super_admin`, `admin`, `content_manager`, `product_manager`, `trade_desk_manager`, `hr_manager`, `enquiry_manager`) plus custom roles; can be deactivated |
| Permission | code catalogue `src/lib/authz/catalog.ts` (synced to `Permission`) | `(resource, action)` pairs, e.g. `products:publish`; resources are grouped into modules and map to admin pages |
| Multiple roles | `UserRole` | permissions of all active roles are combined |
| Individual override | `UserPermissionOverride` | per-employee `allow` / `deny` (optionally scoped) on top of roles |
| Scope | `RolePermission.scope`, override `scope` | `all`, or `assigned` (only records assigned to the employee) for scopable resources (RFQs, contact enquiries) |
| History | `PermissionChangeLog` | who changed which role / permission / status / dashboard, with before/after |

## Resolution rules (`src/lib/authz/resolve.ts`, single implementation, unit-tested)
1. A deactivated / invited account, or an account with no active role, has no access.
2. Grants of all active roles are unioned; a Super Admin role grants everything.
3. Individual **deny wins** over any grant; an individual **allow** adds a permission.
4. `view` is the gate: holding `edit`, `delete`, … without `view` on the same resource grants nothing.
5. If any source grants only `assigned` scope and none grants `all`, the effective scope is `assigned`.

The same module runs in the browser (to shape the UI) and on the server (to decide), so they cannot disagree.

## Where it is enforced
- **Pages**: `src/proxy.ts` asks `/api/auth/page-access` (which re-resolves access from the database) before serving any `/admin/**` page, including client-side navigations. Unauthorised → `/admin/access-denied`; unauthenticated → login. Fails closed (503) if the check cannot be made.
- **APIs**: every handler calls `requireSession()` then `authorize(session, resource, action)` (`src/server/rbac.ts`) **before** reading the body, so unauthorised callers get 403, never validation details. Unknown permissions throw (a typo fails loudly rather than silently allowing/denying).
- **Records**: modules with `assigned` scope filter lists in the query and answer 404 (not 403) for records outside the caller's scope. Bulk operations only touch in-scope records.
- **Read-only modules** answer 405 only *after* `view` is verified, so a caller without access learns nothing about the module.
- **Dashboards**: widgets are filtered by the permissions of the employee; configuration is stored per employee.
- **Private data**: resume downloads require `job_applications:download`, are audited, and are served only as short-lived signed URLs from object storage (not configured yet: answers 503 after authorization).

## Delegation (who may change whose access) — `src/server/authz/delegation.ts`
| Rule | Meaning |
|---|---|
| D1 | Nobody can change their own roles, overrides or status |
| D2 | Only a Super Admin may touch a Super Admin (including deactivated ones, via the *potential* access they would regain) |
| D3 | An actor can manage only employees whose **current** access they fully cover |
| D4 | …and only produce a **resulting** access they fully cover |
| D5 | Roles / overrides can grant only permissions the actor holds (with at least the same scope) |
| D6 | The last active Super Admin can never be deactivated, demoted or have the role removed (checked under row locks, so two concurrent requests cannot both succeed) |

Step-up: the most sensitive operations (status changes, role assignment, permission edits, role status/permissions/deletion, MFA changes) additionally require a recent re-authentication.

## Audit
All changes write to `ActivityLog` (who/what/when/IP, never secrets) in the **same transaction** as the change, and access changes also write `PermissionChangeLog` rows shown on the employee's *Activity History* tab.

## Tests
`src/lib/authz/resolve.test.ts` (policy), `src/server/__tests__/rbac.test.ts` (lifecycle, delegation, escalation attempts, audit), `modules.test.ts` (every generic CMS module: 401 / 403 / read-only / assigned scope, settings, assignees, resumes), and the browser suites described in the final report. `npm run mutation:check` breaks each rule on purpose and requires a test to fail.

## Extending
Add the resource/actions to `catalog.ts`, map its admin path in the page table there, protect the API with `authorize()`, and add it to a default role in `default-roles.ts`. `syncPermissionCatalogue` upserts new permissions on start-up of the seed/bootstrap and never removes existing assignments.
