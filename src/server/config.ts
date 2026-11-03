import "server-only";

/**
 * AUTH CONFIGURATION: the single place environment variables are read and validated.
 *
 *  - Secrets are generated, never typed: `npm run auth:secrets` writes random values to the git-ignored `.env`.
 *  - Required secrets are validated for presence, FORMAT, LENGTH and DISTINCTNESS (one leaked key must not unlock the others).
 *  - A missing or weak secret stops the first auth request with a clear message; there is NO silent fallback.
 *  - Error messages name the variable, never print its value.
 */

const PLACEHOLDER = /^(change[-_ ]?me|replace|your[-_ ]|example|secret|password|xxx|todo|<)/i;

function decode(name: string, raw: string | undefined, minBytes: number, exact = false): Buffer {
  if (!raw) throw new Error(`${name} is not set. Run "npm run auth:secrets" (development) or set it in your secret manager (production).`);
  if (PLACEHOLDER.test(raw)) throw new Error(`${name} still holds a placeholder. Generate a real value with "npm run auth:secrets".`);
  const bytes = Buffer.from(raw, "base64url");
  if (bytes.length < minBytes || (exact && bytes.length !== minBytes)) {
    throw new Error(`${name} must be ${exact ? "exactly " : "at least "}${minBytes} random bytes encoded as base64/base64url (got ${bytes.length}).`);
  }
  if (new Set(bytes).size < 8) throw new Error(`${name} does not look random (too few distinct bytes).`);
  return bytes;
}

const int = (name: string, fallback: number, min: number, max: number) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  return n;
};

const bool = (name: string, fallback: boolean) => {
  const raw = process.env[name];
  return raw === undefined || raw === "" ? fallback : raw === "true" || raw === "1";
};

export interface AuthConfig {
  jwtSecret: Uint8Array;
  otpPepper: Buffer;
  issuer: string;
  audience: string;
  accessTtlSeconds: number;
  /** Refresh token lifetime = the idle window: a session unused this long ends. */
  refreshTtlSeconds: number;
  /** Hard cap on a session regardless of activity. */
  sessionAbsoluteSeconds: number;
  /** A just-rotated refresh token presented again within this window is treated as a race, not theft. */
  refreshGraceSeconds: number;
  otpTtlSeconds: number;
  otpMaxAttempts: number;
  otpResendCooldownSeconds: number;
  activationGrantTtlSeconds: number;
  inviteTtlSeconds: number;
  mfaPendingTtlSeconds: number;
  /** How recently credentials must have been re-entered for high-risk operations. */
  reauthWindowSeconds: number;
  /** Only when a trusted reverse proxy sets X-Forwarded-For may the client IP be read from it. */
  trustProxy: boolean;
  /** Role codes that must use a second sign-in step. */
    secureCookies: boolean;
  argon: { memoryCost: number; timeCost: number; parallelism: number };
}

let cached: AuthConfig | undefined;

export function getAuthConfig(): AuthConfig {
  if (cached) return cached;
  const production = process.env.NODE_ENV === "production";
  const jwt = decode("AUTH_JWT_SECRET", process.env.AUTH_JWT_SECRET, 32);
  const pepper = decode("AUTH_OTP_PEPPER", process.env.AUTH_OTP_PEPPER, 32);
  if (jwt.equals(pepper)) throw new Error("AUTH_JWT_SECRET and AUTH_OTP_PEPPER must be two different values.");

  // Argon2id: 64 MiB / 3 passes / 1 lane. Overridable for tests and benchmarking only; production never goes below these.
  const argon = production
    ? { memoryCost: Math.max(65536, int("AUTH_ARGON_MEMORY_KIB", 65536, 19456, 1048576)), timeCost: Math.max(3, int("AUTH_ARGON_TIME_COST", 3, 1, 10)), parallelism: 1 }
    : { memoryCost: int("AUTH_ARGON_MEMORY_KIB", 65536, 8, 1048576), timeCost: int("AUTH_ARGON_TIME_COST", 3, 1, 10), parallelism: 1 };

  cached = {
    jwtSecret: new Uint8Array(jwt),
    otpPepper: pepper,
    issuer: process.env.AUTH_JWT_ISSUER || "hamsavahin-admin",
    audience: process.env.AUTH_JWT_AUDIENCE || "hamsavahin-admin-api",
    accessTtlSeconds: int("AUTH_ACCESS_TTL_SECONDS", 15 * 60, 30, 3600),
    refreshTtlSeconds: int("AUTH_REFRESH_TTL_SECONDS", 8 * 3600, 60, 30 * 86400),
    sessionAbsoluteSeconds: int("AUTH_SESSION_ABSOLUTE_SECONDS", 24 * 3600, 120, 30 * 86400),
    refreshGraceSeconds: int("AUTH_REFRESH_GRACE_SECONDS", 10, 0, 60),
    otpTtlSeconds: int("AUTH_OTP_TTL_SECONDS", 10 * 60, 30, 900),
    otpMaxAttempts: int("AUTH_OTP_MAX_ATTEMPTS", 5, 1, 10),
    otpResendCooldownSeconds: int("AUTH_OTP_RESEND_COOLDOWN_SECONDS", 60, 0, 600),
    activationGrantTtlSeconds: int("AUTH_ACTIVATION_GRANT_TTL_SECONDS", 10 * 60, 30, 1800),
    inviteTtlSeconds: int("AUTH_INVITE_TTL_SECONDS", 7 * 86400, 3600, 30 * 86400),
    mfaPendingTtlSeconds: int("AUTH_MFA_PENDING_TTL_SECONDS", 10 * 60, 30, 1800),
    reauthWindowSeconds: int("AUTH_REAUTH_WINDOW_SECONDS", 5 * 60, 30, 3600),
    trustProxy: bool("AUTH_TRUST_PROXY", false),
    secureCookies: production ? true : bool("AUTH_SECURE_COOKIES", false),
    argon,
  };
  return cached;
}

/** Test hook: re-read the environment. */
export function resetAuthConfigForTests() {
  cached = undefined;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
}

/**
 * Email through the mailbox your hosting provider gives you (Hostinger, cPanel, or any other host with SMTP).
 *
 *   SMTP_HOST      the provider's outgoing mail server. Hostinger: smtp.hostinger.com. cPanel: usually mail.yourdomain.com
 *                  (use the exact name your provider shows under "Email accounts > Connect devices / Configure mail client").
 *   SMTP_PORT      465 (default, SSL/TLS from the first byte; Hostinger and cPanel both offer it) or 587 (STARTTLS).
 *   SMTP_USER      the FULL mailbox address, for example no-reply@yourdomain.com. (Only a local test relay that needs no sign-in
 *                  can leave SMTP_USER and SMTP_PASSWORD out, with MAIL_FROM set.)
 *   SMTP_PASSWORD  that mailbox's password.
 *   MAIL_FROM      optional sender text. Hosting providers only accept a sender that is the logged-in mailbox, so by default it is
 *                  SMTP_USER; use `Hamsavahin <no-reply@yourdomain.com>` to add a display name while keeping the same address.
 *   SMTP_SECURE    optional "true"/"false" to override the port-based choice (true for 465, false for 587).
 *
 * Returns null when nothing is configured (delivery then honestly reports "not configured"). A half-filled setup throws a
 * message that names the missing variable, never a value.
 */
export function getSmtpConfig(): SmtpConfig | null {
  const e = process.env;
  const host = (e.SMTP_HOST ?? "").trim();
  const user = (e.SMTP_USER ?? "").trim();
  if (!host && !user) return null;
  if (!host) throw new Error("SMTP_HOST is missing. Use your hosting provider's outgoing mail server (Hostinger: smtp.hostinger.com; cPanel: mail.yourdomain.com).");
  if (/[\s/:@]/.test(host)) throw new Error("SMTP_HOST must be only the server name (for example smtp.hostinger.com), without smtp://, a port or an address.");
  const port = e.SMTP_PORT?.trim() ? Number(e.SMTP_PORT) : 465;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT must be a valid port number (465 or 587).");
  if (user && !e.SMTP_PASSWORD) throw new Error("SMTP_USER is set but SMTP_PASSWORD is missing.");
  const from = (e.MAIL_FROM ?? "").trim() || user;
  if (!from) throw new Error("Set SMTP_USER (the full mailbox address) so emails have a sender, or MAIL_FROM for a server that needs no sign-in.");
  return { host, port, secure: e.SMTP_SECURE ? e.SMTP_SECURE === "true" : port === 465, user: user || undefined, password: user ? e.SMTP_PASSWORD : undefined, from };
}

/**
 * The mailbox that receives every message about a form a visitor filled in: SMTP_USER (the hosting mailbox you send from).
 * A server that needs no sign-in has no SMTP_USER; then the address inside MAIL_FROM is used. Null when neither is an address.
 */
export function getNotificationAddress(): string | null {
  const user = process.env.SMTP_USER?.trim();
  if (user && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(user)) return user;
  const from = process.env.MAIL_FROM?.trim() ?? "";
  const m = /<([^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)>/.exec(from) ?? /^([^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/.exec(from);
  return m ? m[1] : null;
}
