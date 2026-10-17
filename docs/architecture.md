# Architecture

One Next.js app, three clearly separated parts. Each has its own folders, its own layout and its own security posture.

| URL | What it is | Routes | Components |
| --- | --- | --- | --- |
| `/` | Public website | `src/app/(site)` | `src/components/web` |
| `/admin/*` | Admin, Super Admin and employee application (login at `/admin/login`) | `src/app/(admin)/admin` | `src/components/admin`, `auth`, `forms`, `modules`, `ui` |
| `/api/*` | Backend HTTP API | `src/app/api` | none (uses `src/server`) |

`(site)` and `(admin)` are Next.js **route groups**: the folder name in parentheses does not appear in the URL. Each group has its own
`layout.tsx` with its own `<html>`/`<body>` and its own `globals.css`, so website styles and admin styles never mix and the
website never ships admin JavaScript.

## Folder map

```
src/
  app/
    (site)/                 PUBLIC WEBSITE  -> /
      layout.tsx            root layout: Header + Footer, public metadata, indexable
      page.tsx              home page (/)  - add website pages here: about/page.tsx -> /about
      globals.css           website styles only
    (admin)/                ADMIN APPLICATION
      layout.tsx            root layout: providers (auth, toasts), noindex metadata
      globals.css           admin styles only
      admin/
        (auth)/             login, activate, forgot/reset password   (no sidebar)
        (shell)/            every signed-in page (dashboard, products, users ...) inside AdminShell
    api/                    BACKEND ROUTES (thin: parse request -> call src/server -> JSON)
    robots.ts               /robots.txt  (allow /, disallow /admin and /api)
  components/
    web/                    website-only UI (Header, Footer ...)  - never imported by the admin
    admin/                  admin shell, sidebar, DataTable, dialogs
    auth/                   sign-in, email-code, activation, password screens
    forms/ modules/ ui/     shared admin building blocks
  server/                   BACKEND ONLY (never imported by client components)
    auth, tokens, crypto, ratelimit, mfa, loginotp, mail  authentication and email
    authz/, rbac.ts         role/permission engine
    resources/              config-driven CMS modules (one definition per entity)
    storage.ts, files.ts    local-disk file storage (uploads/) and upload validation
    db.ts, audit.ts         Prisma access and audit trail
  lib/                      client-side helpers: api client, auth context, services registry, mock data
  proxy.ts                  gate: anonymous visitors to /admin/* are redirected to /admin/login
prisma/                     schema, migrations, seed
docs/                       authentication, RBAC, CMS modules, operations, this file
```

### Where do I write code?

- **A new website page** (`/about`, `/products` ...): `src/app/(site)/about/page.tsx`. Put reusable website pieces in `src/components/web`.
- **A new admin screen**: `src/app/(admin)/admin/(shell)/<name>/page.tsx` and register it in `src/config/navigation.ts`.
- **A new backend endpoint**: `src/app/api/<name>/route.ts`, with the logic in `src/server`.
- **A new CMS entity**: one definition in `src/server/resources`, one service in `src/lib/services`.

Rules that keep the structure clean: `components/web` and `components/admin` do not import each other; client code never imports
`src/server`; the website reads data through public, read-only API routes or server components, never through admin endpoints.

## Security of the split

- **Separate roots.** The website and the admin are different root layouts, so a bug or script in one cannot reach the other's UI code.
- **Gate.** `src/proxy.ts` matches only `/admin/:path*`; anonymous requests get a redirect to `/admin/login`. The real authorization is always
  re-checked in the API (`src/server`), never trusted from the page.
- **Headers on every response** (`next.config.ts`): Content-Security-Policy (same-origin scripts only, no framing, no plugins, forms post only
  to this origin), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
  HSTS and `upgrade-insecure-requests` are added only when `APP_BASE_URL` starts with `https://`. `X-Powered-By` is removed.
- **Admin and API are never indexed or cached**: `X-Robots-Tag: noindex` and `Cache-Control: no-store`; `robots.txt` disallows `/admin` and `/api`.
- **User-uploaded files** (`/api/media/:id/file`) keep their own stricter sandboxing CSP and private caching; the global headers deliberately skip that route.
- **Website is indexable** and carries no admin text, cookies or API calls (verified by a browser test).
- If the website needs a third-party script, font or embed, add that exact host to the CSP in `next.config.ts`; do not use wildcards.

## The public website

Pages, data sources, forms and security are described in [website.md](website.md). In short: `src/app/(site)` holds the pages, `src/components/web` the header, footer, hero, forms and shared sections, `src/content` the written content and menus, and `src/server/services/public.ts` / `submissions.ts` the read-only data and the three public forms. Public pages are always rendered fresh and always send complete HTML.
