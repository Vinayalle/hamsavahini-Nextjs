# Backend integration plan: PostgreSQL + Prisma

Status: **Products and Categories are implemented and verified end to end.** Everything else still runs on the
in-browser mock services and is unchanged. This document is the audit, the schema design and the migration plan.

## 1. Audit summary

Scope reviewed: 56 routes, ~100 source files, 20 mock entities, one service interface (`CrudService<T>`).

**Healthy**
- All pages go through one service interface, so swapping the data source is a one-file change per entity
  (`src/lib/services/index.ts`). Proven: Products and Categories now run on HTTP + PostgreSQL with zero page changes.
- Lint, TypeScript and the production build are clean.

**Defects found and fixed in this pass (UI unchanged)**

| # | Defect | Why it matters for a database | Fix |
|---|---|---|---|
| 1 | Category parent picker allowed cycles (A to B to A) | Infinite loops in any tree walk | Descendants excluded in the UI; server walks ancestors and rejects (422); DB `CHECK` blocks self-parenting |
| 2 | Commodities could be deleted while prices/opportunities used them | Foreign key would reject, mock silently orphaned rows | `deleteGuard` in the UI mirrors `ON DELETE RESTRICT` |
| 3 | Careers could be deleted while applications referenced them | Would destroy or orphan applicants' personal data | Guard in UI; `ON DELETE RESTRICT` in schema |
| 4 | Duplicate commodity prices (same commodity, market, date) were allowed | Violates the new unique constraint | Validation in UI; `UNIQUE(commodityId, market, effectiveDate)` |
| 5 | Breadcrumb linked to `/admin/<module>/<id>` where no detail page exists (commodities, banners, locations, opportunities) | Clicking it produced a 404 | Record crumb only links where a detail page exists |
| 6 | **API handlers validated the body before checking permission** (found by the new tests) | A user without permission got field-level validation errors instead of 403 | Authorization now runs first in every handler; regression test added |

**Inconsistencies in the mock data model (resolved in the schema, mapped in each module's migration step)**

| Mock | Schema |
|---|---|
| Statuses use 5 different vocabularies (`published/draft/archived`, `open/draft/closed`, `open/under_review/closed/draft`, ...) | Separate enums per concept; lowercase members so API values equal UI values |
| `active: boolean` on Location / EmailTemplate vs `status` elsewhere | Kept as `active` (it is a visibility switch, not a lifecycle) |
| `Role.permissions` is a nested matrix | Normalised: `Permission(module, action)` + `RolePermission` join |
| `ProductDocument` vs `DocumentFile` (two document concepts) | One physical table `StoredFile`; `ProductDocument` and `DocumentFile` are views onto it |
| Free-text references: `Post.author`, `Project.commodity`, `Rfq.productOrCommodity`, `NotificationLog.templateKey` | Snapshot text kept where history must survive (author, template key); real FKs added where integrity matters (`CommodityPrice.commodityId`, `TradeOpportunity.commodityId`) |
| `TradeOpportunity.quantity: "5,000 MT"` (string) | `quantityValue Decimal` + `quantityUnit` |
| Display strings as enum values (`"Market Insight"`, `"Contact page"`) | snake_case enums; the API layer maps for display |
| Image `url` can be a `blob:`/`data:` URI | Files are `StoredFile` rows with a storage key; clients never supply URLs |
| TypeScript type `Location` shadows the DOM global | Prisma model keeps the name `Location`; import aliasing is used in server code |
| Product `code` casing not normalised | Stored upper-case, enforced by a DB `CHECK` |

## 2. Schema (see `prisma/schema.prisma`; 32 models, 27 enums)

Conventions: UUIDv7 primary keys; `createdAt/updatedAt` (timestamptz) on every mutable table; `Restrict` on
FKs that would orphan business or personal data, `Cascade` only for pure children (specifications, role permissions,
notes), `SetNull` for optional attribution (assignee, author, uploader).

| Domain | Models | Key constraints / indexes |
|---|---|---|
| Admin users, RBAC | `AdminUser`, `Role`, `Permission`, `RolePermission`, `Session`, `UserToken` | `email` UNIQUE + lowercase CHECK; `Role.name` UNIQUE; `(module, action)` UNIQUE; session `tokenHash` UNIQUE (hash only), index on `expiresAt`; users indexed by role/status |
| Catalogue | `Category`, `Product`, `ProductSpecification`, `ProductImage`, `ProductDocument` | `Category.slug`, `Product.code`, `Product.slug` UNIQUE; code uppercase CHECK; `(productId,label)` UNIQUE; partial unique index = exactly one primary image per product; self-parent CHECK; indexes `(status, updatedAt desc)`, `categoryId`, `(featured,status)` |
| Content | `Post`, `Project`, `Career`, `Location`, `Banner` | slugs UNIQUE; `(status, publishedAt desc)`; `(status, deadline)`; `(name, city)` UNIQUE; schedule/date-order CHECKs |
| Applications | `JobApplication`, `ApplicationNote` | `careerId` RESTRICT; `(careerId,status)`, `email`, `(status,createdAt desc)`; `consentAt`, `anonymizedAt` for retention; resume = private `StoredFile` |
| Trade | `Commodity`, `CommodityPrice`, `TradeOpportunity`, `Rfq`, `RfqNote`, `ContactEnquiry`, `EnquiryNote` | `Commodity.code/slug` UNIQUE; `(commodityId, market, effectiveDate)` UNIQUE; price > 0 CHECK; `Rfq.reference` + `seq` UNIQUE; `(status, createdAt desc)`, `assignedToId`, `email` |
| Files | `StoredFile`, `MediaAsset`, `DocumentFile` | `storageKey` UNIQUE; `visibility` (public/private) and `scanStatus` on every object |
| Notifications | `EmailTemplate`, `NotificationLog` | `EmailTemplate.key` UNIQUE; `(status, createdAt desc)`, `recipient` |
| Audit | `ActivityLog` | append-only; `(createdAt desc)`, `(entityType, entityId)`, `(actorId, createdAt desc)`; actor name snapshotted |
| Settings | `SiteSetting` | one row per section (`general/navigation/seo/contact/footer`), JSON validated by Zod on write |

Commodity prices are manual entries only: there is no market-data integration, no CRM/ERP, no portals.

## 3. Migration plan (incremental, each step verified before the next)

| Step | Scope | Status |
|---|---|---|
| 0 | Schema for **all** modules, one initial migration (`prisma/migrations/*_init`) incl. DB-level CHECKs and the partial index | Done, applied to real PostgreSQL |
| 1 | Auth (see authentication.md), RBAC, audit log, HTTP layer | Done |

Module-by-module status of the screens: [cms-modules.md](cms-modules.md). Steps 2-9 below are implemented on the server and connected to the screens in api mode (file-dependent parts need object storage).
| 2 | **Products + Categories** API, seed, HTTP-backed `CrudService`, UI wiring behind `NEXT_PUBLIC_DATA_SOURCE` | Done, tested |
| 3 | Storage module: S3-compatible pre-signed uploads, `StoredFile`, product images/documents, Media + Document library | Next. Product images/documents cannot persist until this exists |
| 4 | Users, Roles & Permissions, Activity Logs (reads), Settings | |
| 5 | Posts, Projects, Careers, Locations, Banners (sanitise HTML on write) | |
| 6 | Commodities, Prices, Opportunities | |
| 7 | RFQs, Enquiries, Job Applications (+ protected resume download), Email templates / notification history | |
| 8 | Remove each mock service only after its API replacement is tested; keep mock mode available for UI development | |

Per-module recipe: (a) Zod DTO + service with `authorize()` first, (b) route handlers via `route()`, (c) integration tests
against real PostgreSQL covering 401/403/422/409, (d) `createApiCollection` entry in `services/index.ts`, (e) browser test.

## 4. Security model (enforced on the server)

- **Authentication**: superseded by the full design in [authentication.md](authentication.md): email-OTP activation, Argon2id
  (64 MiB / t=3), short-lived access JWT + rotating refresh tokens in HttpOnly cookies, an emailed sign-in code for every employee,
  database-backed rate limiting and progressive lockout, password reset, step-up re-authentication, SMTP email.
- **Authorization**: `authorize(session, module, action)` runs **before** body parsing in every handler and again inside
  the service. `view` is required for any other action. Publishing and un-publishing need the separate `publish` permission.
  Permissions are read from the database on every request, never from the cookie. The frontend `can()` only shapes controls.
- **Mutations**: same-origin check (`Origin` must equal `Host`) and JSON-only bodies on top of SameSite (CSRF defence in depth).
- **Input**: Zod on every body/query; sort columns allow-listed; page size capped; malformed ids are 404; the client can never
  supply file references (images/documents are not accepted fields).
- **Data protection**: audit entries commit in the same transaction as the change; DB errors are mapped to safe messages;
  responses are `Cache-Control: no-store`; no password hash ever leaves the server.
- **Resumes, private documents**: modelled as `StoredFile.visibility = private`; never given a public URL; to be served only
  through short-lived signed URLs minted after a permission check, with each view written to `ActivityLog`
  (`viewed_sensitive`). Implemented in step 3 and step 7.
- **Not yet done**: malware scanning of uploads, `REVOKE UPDATE, DELETE ON "ActivityLog"` for the app role, least-privilege
  DB roles, scheduled purge of expired auth rows, real object storage, and a proven SMTP provider (see operations.md and
  authentication.md "Known limitations").

## 5. Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (required; require TLS in production) |
| `NEXT_PUBLIC_DATA_SOURCE` | `mock` (default) or `api`. Inlined at build time |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | First Super Admin (password >= 12 chars; random one printed once if empty) |
| `SEED_SAMPLE_DATA` | `true` seeds the sample catalogue |
| `FILE_PUBLIC_BASE_URL` | Base URL for public file keys (storage step) |

Commands: `npm run db:dev` (local PostgreSQL, no Docker), `npm run db:deploy` (apply migrations),
`npm run db:seed`, `npm test` (integration tests on a throw-away PostgreSQL).
