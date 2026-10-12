// Local PostgreSQL for development ONLY (no Docker required). Production uses a managed/hosted PostgreSQL.
//
//   npm run db:dev          start (and, first time, initialise) the local cluster; Ctrl-C to stop
//
// The first run generates a random password and writes DATABASE_URL to the git-ignored `.env`.
// Data lives in `.local/pgdata` (git-ignored).
import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env");
const dataDir = resolve(root, ".local", "pgdata");
const PORT = Number(process.env.DEV_DB_PORT ?? 5433);
const DB = "hamsavahin";
const USER = "hamsavahin";

function readEnvUrl() {
  if (!existsSync(envPath)) return null;
  const m = readFileSync(envPath, "utf8").match(/^DATABASE_URL="?([^"\n]+)"?/m);
  return m ? m[1] : null;
}

let url = readEnvUrl();
let password;
if (url) {
  password = decodeURIComponent(new URL(url).password);
} else {
  password = randomBytes(24).toString("base64url");
  url = `postgresql://${USER}:${encodeURIComponent(password)}@localhost:${PORT}/${DB}`;
  const line = `DATABASE_URL="${url}"\n`;
  if (existsSync(envPath)) appendFileSync(envPath, line);
  else writeFileSync(envPath, line);
  console.log("Generated a random database password and wrote DATABASE_URL to .env (git-ignored).");
}

const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: USER, password, port: PORT, persistent: true,
  // Force UTF-8: on Windows initdb otherwise picks WIN1252, which rejects non-Latin text.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});
if (!existsSync(resolve(dataDir, "PG_VERSION"))) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase(DB);
  console.log(`Created database "${DB}".`);
} catch {
  /* already exists */
}
console.log(`PostgreSQL ready on localhost:${PORT} (database "${DB}"). Press Ctrl-C to stop.`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
