# Hamsavahin Super Admin (frontend phase)

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Radix primitives · React Hook Form + Zod · Lucide.

Two data modes, chosen at build time with `NEXT_PUBLIC_DATA_SOURCE`:

- `mock` (default): all data is mock, in browser memory. Changes survive client-side navigation but reset on reload.
- `api`: every CMS module is stored in PostgreSQL via Prisma, behind real authentication and server-side RBAC (status per module in
  [docs/cms-modules.md](docs/cms-modules.md)). Uploaded files (media, documents, resumes, banners, product pictures and documents) are saved
  on disk inside the project, in the `uploads/` folder: no bucket or cloud account needed.

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
an emailed sign-in code for every employee, database-backed rate limiting, SMTP email) is documented in [docs/authentication.md](docs/authentication.md).
Every sign-in is: email + password, then a 6-digit code emailed to the employee (needs `SMTP_USER`/`SMTP_PASSWORD`; no authenticator app).
The first Super Admin is created by `npm run db:seed` with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (12+ characters).
Set `SMTP_*` and `MAIL_FROM` (see `.env.example`) for activation/reset emails; without them emails are reported as *not delivered*.

## UI conventions
- **Icons:** only [react-icons](https://react-icons.github.io/react-icons/) (the Lucide set, `react-icons/lu`). No other icon package.
- **Notifications:** only [react-hot-toast](https://react-hot-toast.com/), through the small wrapper in `src/lib/toast.tsx`:
  `toast.success("Saved", { description: "..." })`, `toast.error(...)`, `toast.warning(...)`, `toast.info(...)`. `<AppToaster />` is mounted once in the admin root layout.
- **Loading states:** never a blank screen and never a premature "empty" message. Shapes live in `src/components/admin/skeletons.tsx`
  (`PageSkeleton`, `TableSkeleton`, `DashboardBodySkeleton`, `DetailSkeleton`, `FormSkeleton`, `ImageGridSkeleton`, `AppShellSkeleton` ...). Route-level
  `loading.tsx` files exist for the admin only; client data uses `useServiceReady()` / `useApi().data` to decide when to swap the skeleton for the real content.
  The public website deliberately has **no** `loading.tsx`: a streamed fallback would leave visitors without JavaScript (and crawlers that do not run it) staring at a skeleton, so website pages always send their complete HTML.
- **Buttons:** a click handler that returns a promise (`onClick={() => save()}`) makes `Button` show its own spinner and ignore double clicks.

## Structure

```
src/app/(site)                    public website, served at /            (own root layout, indexable; see docs/website.md)
src/components/web                website-only components (Header, Footer ...)
src/app/(admin)/admin/(auth)/...  login, activate, reset, outside the shell    -> /admin/login
src/app/(admin)/admin/(shell)/... every authenticated page (shared AdminShell)  -> /admin/...
src/app/api                       backend routes                         -> /api/...
src/server                        backend only: auth, RBAC, CMS resources, storage, mail
(full map and security notes: docs/architecture.md)
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
| Files | `localPreviewStorage` makes `blob:` URLs. **Nothing is uploaded** | Saved on the server's disk in `uploads/`, served only through permission-checked routes |
| Rich text | contentEditable → HTML; admin preview is whitelist-sanitised | Backend must sanitise on save and on render |
| Resumes | UI explains protected access and logs the view | Sent only after a server permission check |

Deliberately **not** included: PostgreSQL, Prisma, live commodity feeds, CRM/ERP, BI, customer/supplier portals.
