// Test runner: provisions a THROW-AWAY PostgreSQL (no Docker), applies every migration with
// `prisma migrate deploy`, runs vitest as a child process, then tears the database down and exits with
// vitest's REAL exit code (so CI fails when tests fail).
//
//   npm test                         run everything
//   npm test -- src/server           pass any vitest arguments
//
// The tests wipe tables, so they REFUSE to run unless DATABASE_URL points at the database named "hv_test"
// created here (see src/server/__tests__/setup-guard.ts). They can never touch your development database.
import EmbeddedPostgres from "embedded-postgres";
import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 5500 + Math.floor(Math.random() * 400);
const password = randomBytes(18).toString("base64url");
const dir = mkdtempSync(join(tmpdir(), "hv-test-pg-"));

const pg = new EmbeddedPostgres({
  databaseDir: dir, user: "hvtest", password, port, persistent: false,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

let code = 1;
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("hv_test");
  const url = `postgresql://hvtest:${encodeURIComponent(password)}@localhost:${port}/hv_test`;
  const env = { ...process.env, DATABASE_URL: url, HV_TEST_DB: "1" };
  execSync("npx prisma migrate deploy", { cwd: root, env, stdio: "pipe" });
  const vitest = join(root, "node_modules", "vitest", "vitest.mjs");
  const args = process.argv.slice(2);
  const r = spawnSync(process.execPath, [vitest, "run", ...args], { cwd: root, env, stdio: "inherit" });
  code = r.status ?? 1;
} catch (e) {
  console.error("Test runner failed:", e instanceof Error ? e.message : e);
  code = 1;
} finally {
  await pg.stop().catch(() => undefined);
  rmSync(dir, { recursive: true, force: true });
}
process.exit(code);
