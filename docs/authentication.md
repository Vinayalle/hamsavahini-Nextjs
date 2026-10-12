# Authentication architecture

Applies to `NEXT_PUBLIC_DATA_SOURCE=api` (PostgreSQL + server-side authentication). In the default `mock` mode there is **no** authentication: it is a UI preview that never checks a password and is never used as a fallback in api mode.

## At a glance

| Concern | Implementation |
|---|---|
| First login | Admin invites → employee requests an **email OTP** → verifies → creates a password. Roles come only from the invitation (RBAC); verifying an email grants nothing. |
| Later logins | Email + password, then (default, `AUTH_MFA_METHOD=email`) a **6-digit code emailed to the employee at every sign-in**, for every role. No authenticator app. |
| Password storage | **Argon2id**, 64 MiB / 3 passes / 1 lane (≈200 ms), parameters embedded in each hash; **rehashed on login** if parameters are raised. |
| Password policy | One module (`src/lib/authz/password-policy.ts`) shared by server and UI: ≥12 chars, upper/lower/digit/special, must not contain name / email / username / company name (case-, separator-, accent- and leetspeak-insensitive), offline common-password blocklist. Enforced on activation, reset and change. |
| Sessions | Short-lived **access JWT** (HS256, 15 min) + **rotating opaque refresh token** (hash only in DB) in **HttpOnly** cookies. Reuse of a rotated refresh token revokes the whole session. |
| Second step | Default **email code** for everyone (HMAC-digested, 5-minute expiry, single use, 5 attempts, resend cooldown). Optional alternative `AUTH_MFA_METHOD=totp`: authenticator app (RFC 6238) for `super_admin`/`admin` only, secrets encrypted with **AES-256-GCM**, replay-protected, 10 recovery codes. |
| Step-up | Sensitive operations need a recent re-authentication (password + second factor). |
| Rate limiting | Database-backed counters shared by all instances; progressive (never permanent) account lockout; generic error responses. |
| CSRF | Same-origin (`Origin` = `Host`) + JSON-only bodies + `SameSite` cookies (Lax access, Strict for the rest). |
| Email | SMTP (any relay or provider SMTP endpoint), branded HTML + text templates, STARTTLS required by default. Bodies are never logged. |

## Flows

### Activation (first-time)
1. A user with `users:create` creates the employee (status `invited`) → an *invitation marker* (hashed, expiring, default 7 days) is stored and an invitation email is sent. The email carries **no secret**, just a link to `/admin/activate`.
2. `POST /api/auth/activate/request-otp` (or `/api/auth/verification/resend`): identical response whether or not the address has an invitation. Eligible accounts get a 6-digit code (`crypto.randomInt`); only `HMAC-SHA256(pepper, challengeId‖userId‖code)` is stored. Expires in 5 minutes; resend cooldown 60 s; issuing a new code invalidates the previous one; requests for one account are serialised with a row lock.
3. `POST /api/auth/activate/verify-otp`: attempt budget claimed atomically (5), constant-time comparison, single-use (`consumedAt` claimed atomically). Success sets an **HttpOnly `hv_act` cookie** holding a 10-minute single-use *activation grant* (stored as SHA-256). The grant is never in a JSON body.
4. `POST /api/auth/activate/set-password`: validates the grant, applies the shared policy (a rejected password does **not** burn the grant), hashes with Argon2id, sets `status=active`, `emailVerifiedAt`, consumes the grant and invitation. **Does not sign the user in**; they then sign in normally (admins must enrol MFA at that point).

A reset token cannot be used as an activation grant and vice-versa (distinct `UserTokenType`s, checked on use).

### Login
**Email-code mode (default).** After a correct password the server emails a 6-digit code (nodemailer) and sets only a 5-minute `hv_mfa` proof cookie; no session exists yet. `POST /api/auth/mfa/verify {code}` consumes the code (single use, 5 attempts, atomic) and creates the session; `POST /api/auth/mfa/resend` re-sends after a 60 s cooldown (a new code invalidates the old one). A wrong password sends nothing. If the email cannot be sent the user gets a clear 503 and no session or usable code is left behind. The code is never logged, stored in plain text or returned in a response. **SMTP must work, or nobody can sign in**: set `SMTP_USER`/`SMTP_PASSWORD`. A mailbox compromise is an account compromise, which is the trade-off of email codes versus an authenticator app.

The rest of this section describes the authenticator-app mode (`AUTH_MFA_METHOD=totp`).
`POST /api/auth/login` → generic `401 invalid_credentials` for wrong password, unknown, deactivated, not-yet-activated and locked accounts (a dummy Argon2id verification equalises timing).
- Role needs MFA → response `{status:"mfa_required", enrolled}` and **only** a 5-minute `hv_mfa` proof cookie; no session exists yet. Then `POST /api/auth/mfa/verify` (TOTP or recovery code), or `mfa/enroll/start` + `mfa/enroll/confirm` (QR + recovery codes shown once).
- Otherwise a session (refresh-token family) and the cookies are created.
- Lockout: 5 consecutive failures → 1 min, doubling to a 30-min ceiling, self-healing. Plus per-account (8 / 15 min) and per-source (60 / 15 min) rate limits.

### Tokens
| Cookie | Content | Path | SameSite | Lifetime |
|---|---|---|---|---|
| `hv_at` | access JWT (`iss`,`aud`,`sub`,`sid`,`jti`,`iat`,`exp`,`use`) | `/` | Lax | 15 min |
| `hv_rt` | opaque 256-bit refresh token | `/api/auth` | Strict | idle window 8 h, absolute session cap 24 h |
| `hv_mfa` | pending-MFA JWT | `/api/auth` | Strict | 5 min |
| `hv_act` | activation grant | `/api/auth` | Strict | 10 min |

`Secure` is always set in production. **Nothing is stored in localStorage/sessionStorage.** The JWT carries identity only. **Every request** re-checks in the database that the session exists and is unexpired, the account is active, MFA was completed if required, and recomputes permissions, so a revoked permission, a deactivation or a role change applies to the very next request.

Verification pins `HS256`, and requires issuer, audience, expiry, `sub`, `sid`, `jti` and the `use` claim (an MFA-pending token is never accepted as an access token).

**Refresh** (`POST /api/auth/refresh`): atomically claims the presented token (`usedAt IS NULL`), issues a new pair, links `replacedById`. A rotated token presented again within 10 s is a benign race (401 `refresh_conflict`, session kept); after that it is treated as theft: the whole session is deleted, an audit `token_reuse` entry is written. The browser client refreshes once silently on a 401 and retries; the login page also tries a silent restore (so a navigation after the 15-minute access token expiry does not force a re-login).

**Logout** deletes the session (works from the refresh cookie alone). Password change/reset, deactivation and MFA reset delete sessions (refresh tokens cascade).

### Password reset
`POST /api/auth/password/forgot` (generic answer, 3/h per account) → single-use 1-hour link (SHA-256 stored) → `POST /api/auth/password/reset`: policy, must differ from the current password, all sessions and refresh tokens revoked, audit + security-notice email. Resetting a password **does not bypass MFA**.

### MFA
- Enrolment: server generates a 160-bit secret, stores `AES-256-GCM(secret, key, aad=userId)` (`v1.<iv>.<tag>.<ct>`), returns the secret/QR **once**, enables after the first valid code and returns 10 recovery codes (50 bits each, shown once, stored as keyed digests).
- Verification: ±1 step of drift; the accepted time-step is recorded with an atomic `UPDATE … WHERE lastUsedStep < step` so a code can never be replayed; 10 attempts / 15 min per account.
- Admins/Super Admins **cannot disable their own MFA**; only a **Super Admin** can reset *another* employee's MFA (`POST /api/users/[id]/mfa-reset`; never for oneself; requires recent re-authentication; revokes the target's sessions; audited; target notified). An Admin or ordinary employee with `users:edit` cannot.
- Policy drift: a session of someone who later gained an MFA-required role without completing MFA is rejected until they sign in again and enrol.

### Step-up re-authentication
`POST /api/auth/reauth {password, code?}` stamps `Session.reauthAt`. Routes that call `requireRecentAuth()` (changing user status/roles/overrides, role permissions/status/deletion, MFA reset/disable/recovery-codes) answer `403 reauth_required` if the last authentication is older than 5 minutes (authorization is evaluated first, so unauthorised callers learn nothing). The UI opens a prompt and repeats the request.

## Endpoints
`POST /api/auth/…`: `activate/request-otp`, `activate/verify-otp`, `activate/set-password`, `verification/resend`, `login`, `mfa/verify`, `mfa/enroll/start`, `mfa/enroll/confirm`, `mfa/recovery-codes`, `refresh`, `logout`, `reauth`, `password/forgot`, `password/reset`, `change-password`; `GET /api/auth/me`, `GET|DELETE /api/auth/mfa`, `GET /api/auth/page-access`; `POST /api/users/[id]/mfa-reset`.

## Configuration
See `.env.example`. Required in api mode: `AUTH_JWT_SECRET`, `AUTH_OTP_PEPPER`, `AUTH_ENCRYPTION_KEY` (three **different** random 256-bit base64url values; the last is exactly 32 bytes). `npm run auth:secrets` writes missing ones to the git-ignored `.env` without printing them; `npm run auth:secrets -- --print` prints fresh values for a secret manager. Startup validation (`src/server/config.ts`) rejects missing, short, placeholder, low-entropy or duplicated values and never echoes them. There is **no development fallback**; production additionally forces Secure cookies and never permits Argon2id parameters below 64 MiB / t=3.

Email (nodemailer): only `SMTP_USER` and `SMTP_PASSWORD` are required (Gmail: use an app password). Defaults: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `MAIL_FROM=SMTP_USER`; set `SMTP_HOST`/`SMTP_PORT`/`MAIL_FROM` only for another provider or sender. `APP_BASE_URL` (public HTTPS origin) is needed in production for email links. Without credentials the app honestly reports "not delivered"; OTP activation cannot complete, and an administrator who invites someone sees the (secret-free) activation link to pass on.

`AUTH_TRUST_PROXY=true` only behind a reverse proxy that **overwrites** `X-Forwarded-For`; otherwise the header is ignored (source limits then share one generous bucket and per-account limits do the real work).

### Rotating secrets
- `AUTH_JWT_SECRET`: replace and restart → all access tokens invalid (users refresh transparently).
- `AUTH_OTP_PEPPER`: replace → outstanding OTPs and **unused MFA recovery codes stop working** (users need new recovery codes; an admin can reset MFA).
- `AUTH_ENCRYPTION_KEY`: replacing it makes stored TOTP secrets undecryptable → every MFA user must be reset. Re-encrypt first (decrypt with old key, encrypt with new) in a maintenance script before swapping.

## Database (migration `20261012180000_secure_auth_jwt_otp_mfa`)
Additive: `RefreshToken`, `AuthChallenge`, `MfaCredential`, `MfaRecoveryCode`, `RateLimit`; `Session` gains `mfaVerifiedAt`, `reauthAt` and `tokenHash` becomes optional (legacy cookie sessions simply expire); `AdminUser.emailVerifiedAt` (back-filled for accounts that already set a password); new enum values. Nothing is dropped or rewritten. Rehearsed on a clone, row counts and checksums compared, drift check clean, then applied.

## Testing
`npm test` provisions a throw-away PostgreSQL and runs everything. Auth-specific files: `auth-units.test.ts` (RFC 6238/4226 vectors, AES-GCM, JWT attacks, config, Argon2id), `auth.test.ts` (activation, login, limits incl. concurrency, sessions, refresh rotation/reuse, MFA, step-up, reset, CSRF, no-secret-in-logs), `smtp.test.ts` (real SMTP conversation against a local sink), plus the password-policy and RBAC suites.

## Known limitations
- TLS must be terminated by your platform/reverse proxy (HSTS recommended); the app sets `Secure` cookies but cannot enforce HTTPS itself.
- Real SMTP provider delivery is **untested** here (no credentials); only a local SMTP sink was exercised.
- Expired rows (sessions, tokens, challenges, rate-limit counters) are not purged automatically; add a scheduled cleanup (`DELETE … WHERE expiresAt < now() - interval '7 days'`).
- Per-source limits are weak without a trusted proxy (see above).
- Cookie names are fixed (`hv_*`); running two environments on one parent domain needs distinct names.
- The OTP email is the only recovery for lost mailbox access; an administrator must re-invite.
