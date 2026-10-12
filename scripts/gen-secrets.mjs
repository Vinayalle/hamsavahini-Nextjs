// Generates the authentication secrets and appends any that are MISSING to the git-ignored `.env`.
//
//   npm run auth:secrets            add missing AUTH_* secrets to .env (existing values are never overwritten)
//   npm run auth:secrets -- --print print fresh values to stdout instead (for pasting into a production secret manager)
//
// Values are random (256-bit) and are NOT echoed to the terminal when written to .env.
// For production, generate with --print and store them in your secret manager; do not commit them anywhere.
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(import.meta.dirname, "..", ".env");
const names = ["AUTH_JWT_SECRET", "AUTH_OTP_PEPPER", "AUTH_ENCRYPTION_KEY"];
const fresh = () => randomBytes(32).toString("base64url");

if (process.argv.includes("--print")) {
  for (const n of names) console.log(`${n}=${fresh()}`);
  process.exit(0);
}

const current = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const missing = names.filter((n) => !new RegExp(`^${n}=.+`, "m").test(current));
if (missing.length === 0) {
  console.log("All authentication secrets are already present in .env (nothing changed).");
} else {
  const block = `${current.endsWith("\n") || current === "" ? "" : "\n"}# Authentication secrets (generated ${new Date().toISOString().slice(0, 10)}). Never commit; rotate by replacing the value.\n${missing.map((n) => `${n}=${fresh()}`).join("\n")}\n`;
  appendFileSync(envPath, block);
  console.log(`Added ${missing.length} secret(s) to .env: ${missing.join(", ")} (values not displayed).`);
}
