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

## File storage (media, documents, resumes)
Files live in a **private S3-compatible bucket** (AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, Backblaze B2 ...), configured with `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (+ `S3_REGION`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` for non-AWS). Credentials never leave the server.
- Turn **Block all public access** on and give the key only `PutObject`/`GetObject`/`DeleteObject` on that bucket. No bucket policy for the public.
- **Uploads** go browser → app (multipart) → bucket. The server decides the file type from its bytes (PNG, JPEG, WebP, MP4 for media; PDF, DOC/DOCX, XLS/XLSX for documents), enforces size caps (image 5 MB, video 50 MB, document 10 MB), rejects SVG/HTML/scripts and mismatched types, sanitises the name, and stores under a random key. The reply is a success only after the object **and** its database row both exist; a failed database write removes the object again, a failed storage write stores nothing.
- **Downloads**: media is streamed through `/api/media/<id>/file` after a `media:view` check (`nosniff`, locked-down CSP, `private` cache); documents and resumes return a **60-second signed link** after `documents:download` / `job_applications:download`; non-public documents and every resume download are written to the audit log.
- New files start with `scanStatus = pending`. Nothing scans them yet (add a malware scanner such as ClamAV before opening uploads to untrusted users); a file marked `quarantined` is never served.
- Product images and product documents are **not** connected to storage yet (the pages say so).
- Tested against a local S3-compatible server (`s3rver`) with the real AWS SDK; not yet against a live provider.

## Deployment checklist
- [ ] `NEXT_PUBLIC_DATA_SOURCE=api` at **build** time; Node 22+.
- [ ] Managed PostgreSQL with TLS (`?sslmode=require`); `DATABASE_URL` from the secret manager; dedicated least-privilege DB user.
- [ ] Secrets from a secret manager: `AUTH_JWT_SECRET`, `AUTH_OTP_PEPPER`, `AUTH_ENCRYPTION_KEY` (three different random 256-bit values: `npm run auth:secrets -- --print`). Never commit; plan rotation (see authentication.md).
- [ ] `APP_BASE_URL` = the public HTTPS origin (used in email links).
- [ ] Email: `SMTP_USER` + `SMTP_PASSWORD` (host/port/sender only if not Gmail-style defaults) tested with a real send; SPF/DKIM/DMARC configured for the sender domain.
- [ ] HTTPS only. Terminate TLS at the platform/reverse proxy, redirect HTTP→HTTPS, send `Strict-Transport-Security`. Cookies are `Secure` in production, so the site will not sign anyone in over plain HTTP.
- [ ] If behind a reverse proxy that **overwrites** `X-Forwarded-For`: `AUTH_TRUST_PROXY=true` (otherwise per-IP limits share one bucket).
- [ ] `npx prisma migrate deploy` run once per release (not on every instance start); backup taken first.
- [ ] First Super Admin: `SEED_ADMIN_EMAIL=… npm run db:seed` (prints a generated password once) → sign in → enrol MFA → store recovery codes.
- [ ] Scheduled cleanup of expired `Session`, `RefreshToken`, `AuthChallenge`, `UserToken`, `RateLimit` rows.
- [ ] Object storage configured (`S3_*`, private bucket, least-privilege key) before enabling resumes / media / documents; test one upload and one download.
- [ ] Log shipping and alerting on `login_failed`, `token_reuse`, `mfa_failed`, 429 spikes.
