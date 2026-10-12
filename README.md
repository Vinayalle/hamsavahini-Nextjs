# Hamsavahin Super Admin (frontend phase)

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Radix primitives · React Hook Form + Zod · Lucide.

Two data modes, chosen at build time with `NEXT_PUBLIC_DATA_SOURCE`:

- `mock` (default): all data is mock, in browser memory. Changes survive client-side navigation but reset on reload.
- `api`: every CMS module is stored in PostgreSQL via Prisma, behind real authentication and server-side RBAC (status per module in
  [docs/cms-modules.md](docs/cms-modules.md)). Media, documents and resume downloads additionally need an S3-compatible bucket
  (`S3_*` variables, see `.env.example`); without it they say so and refuse, nothing is faked. Product images/documents are not wired to storage yet.

## Run

```bash
npm install
npm run dev        # http://localhost:3000  (opens /admin/dashboard → redirects to /admin/login)
npm run build && npm start
npm run lint && npm run typecheck
```

**Mock mode:** sign in with any valid-looking email and an 8+ character password. This is a **development-only mock
session**: nothing is verified, no password is stored, and it provides no security.

## Run with the database (api mode)

```bash
cp .env.example .env            # or let `npm run db:dev` generate DATABASE_URL for you (local dev only)
npm run db:dev                  # local PostgreSQL, no Docker. Leave running (Ctrl-C to stop)
npm run db:deploy               # apply migrations
npm run auth:secrets            # generates AUTH_JWT_SECRET / AUTH_OTP_PEPPER / AUTH_ENCRYPTION_KEY into .env (values not printed)
SEED_ADMIN_EMAIL=you@example.com SEED_SAMPLE_DATA=true npm run db:seed   # prints a generated password once
NEXT_PUBLIC_DATA_SOURCE=api npm run build && npm start
npm test                        # integration tests against a throw-away PostgreSQL
```

In production use a managed PostgreSQL (TLS required) and set `DATABASE_URL` in the environment, not in the repo.

**Authentication in api mode** (email OTP activation, Argon2id passwords, access JWT + rotating refresh tokens in HttpOnly cookies,
TOTP MFA for Super Admins/Admins, database-backed rate limiting, SMTP email) is documented in [docs/authentication.md](docs/authentication.md).
The first Super Admin created by the seed signs in with the printed password and is then walked through MFA enrolment.
Set `SMTP_*` and `MAIL_FROM` (see `.env.example`) for activation/reset emails; without them emails are reported as *not delivered*.

## Structure

```
src/app/admin/(auth)/login        login, outside the dashboard shell
src/app/admin/(shell)/...         every authenticated page (shared AdminShell via layout.tsx)
src/components/admin              shell, sidebar, header, breadcrumbs, DataTable, ResourceList, dialogs, drawers…
src/components/forms              EntityForm (config-driven), uploaders, rich-text editor, tag input
src/components/modules            module-specific forms/workflows (products, settings, RFQ/case drawer…)
src/config/navigation.ts          single source of truth for the sidebar and breadcrumbs
src/lib/mock                      in-memory collection engine + seed data (one file per domain)
src/lib/services                  service registry: one CrudService<T> per entity
src/lib/auth                      AuthService boundary (dev mock today)
src/lib/storage.ts                FileStorage boundary (local previews today)
src/types                         typed entities
```

## Integration boundaries (what to replace later)

| Concern | Today | Replace with |
| --- | --- | --- |
| Data | `createCollection()` in `src/lib/mock/collection.ts`, exposed as `CrudService<T>` | HTTP-backed implementations of the same interface; swap `useResource` for a fetch hook |
| Auth | mock: `src/lib/auth` dev session in `sessionStorage` (no security). api: HttpOnly-cookie JWT + refresh sessions | see docs/authentication.md |
| Permissions | `can()` is a UI hint only | Backend RBAC on every request. The frontend is never the authority |
| Files | `localPreviewStorage` makes `blob:` URLs. **Nothing is uploaded** | Pre-signed S3-compatible uploads issued by the API |
| Rich text | contentEditable → HTML; admin preview is whitelist-sanitised | Backend must sanitise on save and on render |
| Resumes | UI explains protected access and logs the view | Short-lived signed URLs after a server permission check |

Deliberately **not** included: PostgreSQL, Prisma, S3 SDKs, live commodity feeds, CRM/ERP, BI, customer/supplier portals.
