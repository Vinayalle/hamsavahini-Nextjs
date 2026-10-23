import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Test-only configuration. Secrets are random PER RUN (never committed, never reused outside tests) and the Argon2id cost is
 * lowered so the suite is fast; a dedicated test proves the production parameters are the 64 MiB / t=3 / p=1 defaults.
 */
const b64 = () => randomBytes(32).toString("base64url");
process.env.AUTH_JWT_SECRET = b64();
process.env.AUTH_OTP_PEPPER = b64();
process.env.AUTH_ARGON_MEMORY_KIB = "1024";
process.env.AUTH_ARGON_TIME_COST = "2";
process.env.AUTH_TRUST_PROXY = "true"; // lets tests present distinct source addresses
process.env.AUTH_OTP_RESEND_COOLDOWN_SECONDS = "60";
process.env.APP_BASE_URL = "http://localhost:3000";
// Files go to a throwaway folder, never the real <project>/uploads.
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), "hv-uploads-"));
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASSWORD;
