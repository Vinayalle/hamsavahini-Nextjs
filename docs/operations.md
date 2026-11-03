# Operations: migrations, backups, deployment

## Database migrations (Prisma, hand-reviewed SQL)

Migrations live in `prisma/migrations/` and are **additive and data-preserving**. Applied so far:

| Migration | Purpose |
|---|---|
| `20261011194825_init` | base schema |
| `20261012070000_rbac_multi_role_permissions` | multi-role RBAC, overrides, history, dashboards |
| `20261012120000_pdf_alignment_catalogue_fields` | status vocabularies / trade fields from the business notes (old values are mapped, not dropped) |
| `20261012180000_secure_auth_jwt_otp_mfa` | refresh tokens, email OTP challenges, MFA, shared rate limits, `Session`/`AdminUser` columns |

### Procedure for every new migration
1. **Back up**: `CREATE DATABASE hv_backup_<tag> TEMPLATE <live>` on the same server (instant, includes data), and/or `pg_dump`. For managed PostgreSQL take a snapshot first. Never run `migrate reset`, `db push --force-reset` or `DROP` against a database holding real data.
2. **Snapshot counts/checksums**: `npx tsx scripts/db-snapshot.mts > before.json` (read-only; excludes secrets).
3. **Rehearse on a clone**: `node scripts/rehearse-migration.mjs` creates `hv_rehearsal` from the dev database; run `DATABASE_URL=<clone url> npx prisma migrate deploy` against it, snapshot again and compare (only tables whose columns changed may differ).
4. **Drift check**: `DATABASE_URL=<clone url> npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` must report no difference.
5. **Apply**: `npx prisma migrate deploy` (never `migrate dev` outside local development).
6. `npx prisma generate`, run `npm test`.

### Rollback
Migrations are forward-only. To roll back, restore the pre-migration snapshot/backup taken in step 1 (the old application version keeps working with the additive columns/tables, so a code rollback alone is usually enough while the data stays).

### Time zone
The application pins its PostgreSQL **session** time zone to UTC (`src/server/db.ts`). Without that, the driver adapter stored timestamps 5.5 h off on a server running in `Asia/Kolkata` (found by a browser test). A regression test covers it. Rows written before the pin on such a server keep their old (shifted) instants; this only affects local development data.

## Backups kept by earlier phases (do not delete without approval)
`hv_rehearsal` (clone used to rehearse migration 4), `hv_backup_preauth` (clone of the dev database immediately before migration 4), and `.local/backups/` (file-level copies before migrations 2 and 3). They contain development data only.

## File storage (media, documents, resumes, product files)
Every uploaded file is stored on the server's own disk, in the project's **`uploads/`** folder (`uploads/media`, `uploads/documents`, `uploads/resumes`, `uploads/products`). There is no bucket and no cloud service. To keep the files somewhere else, set `UPLOAD_DIR` (media, documents, resumes), `BANNER_UPLOAD_DIR` or `PRODUCT_UPLOAD_DIR`.
- The folder is **never served as static files**; the bytes are only read back through our own routes. The folder is **committed to git** together with the code (it is not ignored), so pictures and documents travel with the repository; keep it on a persistent disk too, and back it up with the database. Mount it on a persistent disk in production (a platform with an ephemeral filesystem would lose it on every deploy).
- **Uploads** go browser -> app (multipart) -> disk. The server decides the file type from its bytes (PNG, JPEG, WebP, MP4 for media; PDF, DOC/DOCX, XLS/XLSX for documents), enforces size caps (image 5 MB, video 50 MB, document 10 MB), rejects SVG/HTML/scripts, and names the file with a random key (the original name is kept only in the database).
- **Downloads**: media is streamed through `/api/media/<id>/file` after a `media:view` check (`nosniff`, locked-down CSP, `private` cache); documents and resumes are sent by `/api/documents/<id>/download` and `/api/applications/<id>/resume` after `documents:download` / `job_applications:download` (no public link, nothing to expire); non-public downloads are audited.
- New files start with `scanStatus = pending`. Nothing scans them yet (add a malware scanner such as ClamAV before opening uploads to untrusted users); a file marked `quarantined` is never served.

## Deployment checklist
- [ ] `NEXT_PUBLIC_DATA_SOURCE=api` at **build** time; Node 22+.
- [ ] Managed PostgreSQL with TLS (`?sslmode=require`); `DATABASE_URL` from the secret manager; dedicated least-privilege DB user.
- [ ] Secrets from a secret manager: `AUTH_JWT_SECRET`, `AUTH_OTP_PEPPER`, `AUTH_ENCRYPTION_KEY` (three different random 256-bit values: `npm run auth:secrets -- --print`). Never commit; plan rotation (see authentication.md).
- [ ] The public address is fixed in `src/lib/site-url.ts` (`SITE_URL`, currently https://hamsavahin.in); no setting is needed. Change it there if the site moves (for example to the www form). `APP_BASE_URL` is only an optional override (for example to run a production build on http://localhost:3000).
- [ ] Email: `SMTP_HOST` + `SMTP_USER` (full mailbox address) + `SMTP_PASSWORD` for your hosting provider's mailbox (Hostinger: smtp.hostinger.com, cPanel: mail.yourdomain.com; port 465 or 587) tested with a real send; SPF/DKIM/DMARC configured for the sender domain.
- [ ] HTTPS only. Terminate TLS at the platform/reverse proxy, redirect HTTP→HTTPS, send `Strict-Transport-Security`. Cookies are `Secure` in production, so the site will not sign anyone in over plain HTTP.
- [ ] If behind a reverse proxy that **overwrites** `X-Forwarded-For`: `AUTH_TRUST_PROXY=true` (otherwise per-IP limits share one bucket).
- [ ] `npx prisma migrate deploy` run once per release (not on every instance start); backup taken first.
- [ ] First Super Admin: `SEED_ADMIN_EMAIL=… npm run db:seed` (prints a generated password once) → sign in → enrol MFA → store recovery codes.
- [ ] Scheduled cleanup of expired `Session`, `RefreshToken`, `AuthChallenge`, `UserToken`, `RateLimit` rows.
- [ ] The `uploads/` folder (or `UPLOAD_DIR`) is on a persistent, backed-up disk; test one upload and one download.
- [ ] Log shipping and alerting on `login_failed`, `token_reuse`, `mfa_failed`, 429 spikes.

## Daily uploads cleanup

Files that nothing uses any more (a record was deleted but its file stayed, or the other way round) are removed by the uploads cleanup (`src/lib/uploads-cleanup.ts`): it only looks at files named like the app names uploads, leaves anything younger than 24 hours alone, deletes at most 500 per run, and refuses to delete anything when most files look orphaned (usually the wrong database).

**Where the website runs matters.** Uploaded files are stored in the server's own `uploads/` folder, so every place that uploads or shows pictures must be the SAME server with a persistent disk (for example a Hostinger VPS). A serverless host such as Vercel has no persistent disk: files written there vanish, so uploads, pictures and this cleanup cannot work on it.

### Default: the server does it by itself (no domain, secret or outside service)
The server runs the cleanup every day at **02:00 India time** (20:30 UTC, whatever time zone the server uses), while it is running, in production and in `npm run dev`. Nothing to set up and no setting to switch it. Problems and deletions are printed in the server's log with the prefix `[uploads]`.

You can also run it by hand on the server: `npm run uploads:cleanup -- --dry-run` (shows what would go, deletes nothing), then `npm run uploads:cleanup`. A server that is not left running can schedule that command with cron or the Windows Task Scheduler.

### Optional: Supabase Cron calls the website instead
Use this only if you also want an outside scheduler and the site has a public address. The server's own daily run stays on, so both may run on the same day; the second one simply finds nothing left to delete. Supabase only sends the request; the deleting happens on the website server.

1. **Secret.** In the production server's environment settings add `CRON_SECRET` with a long random value (for example `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`). Never commit it. Without it the address answers 404.
2. **Supabase:** turn on the `pg_cron` and `pg_net` extensions (Integrations > Cron, or SQL Editor: `create extension if not exists pg_cron; create extension if not exists pg_net;`), then create the job. In the SQL Editor:
```sql
select cron.schedule(
  'uploads-cleanup', '30 20 * * *',
  $$ select net.http_post(
       url := 'https://YOUR-SITE-ADDRESS/api/cron/uploads-cleanup',
       headers := jsonb_build_object('Authorization', 'Bearer <the CRON_SECRET>', 'Content-Type', 'application/json'),
       body := '{}'::jsonb,
       timeout_milliseconds := 300000
     ); $$
);
```
`30 20 * * *` is 02:00 India time because Supabase Cron uses UTC. The secret is stored inside the job (visible to database admins). To remove the job: `select cron.unschedule('uploads-cleanup');`.
3. **Test** with a dry run, which deletes nothing: `curl -X POST -H "Authorization: Bearer <secret>" "https://YOUR-SITE-ADDRESS/api/cron/uploads-cleanup?dryRun=1"`.
4. **Check runs:** `select * from cron.job_run_details order by start_time desc limit 5;` (the website's answer is in `net._http_response`). The answer has `ok: false` and `refused` set when the cleanup stopped because most files looked orphaned.

A paused Supabase project stops its cron jobs, and a website that is down at 02:00 misses that run (the next day's run catches up).
