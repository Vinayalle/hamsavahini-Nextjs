/**
 * Deletes uploaded files that nothing uses any more (see src/lib/uploads-cleanup.ts for exactly what and how it stays safe).
 *
 *   npm run uploads:cleanup -- --dry-run            show what would go, delete nothing (start here)
 *   npm run uploads:cleanup                         delete
 *   npm run uploads:cleanup -- --min-age-hours=48   leave anything newer than 48 hours alone (default 24)
 *   npm run uploads:cleanup -- --force              skip the "looks like the wrong database" check
 *
 * Schedule it with the Windows Task Scheduler or cron (for example once a day) if the server is not left running; the server already runs it by itself
 * every day at 02:00 India time (src/instrumentation-node.ts), so this is for trying it or for a one-off run.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { pgConnection } from "../src/lib/db-url";
import { cleanupUploads, describeCleanup } from "../src/lib/uploads-cleanup";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const arg = (name: string) => process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const hours = Number(arg("min-age-hours")?.split("=")[1] ?? 24);
if (!Number.isFinite(hours) || hours < 0) throw new Error("--min-age-hours must be a number of hours (0 or more)");

const db = new PrismaClient({ adapter: new PrismaPg(pgConnection(url)) });

// Wrapped in a function: this project is CommonJS, where a top-level await does not compile.
async function main() {
  const report = await cleanupUploads(db, { dryRun: !!arg("dry-run"), force: !!arg("force"), minAgeMs: hours * 3_600_000 });
  console.log(describeCleanup(report));
  if (report.refused || report.failures.length) process.exitCode = 1;
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
