import { cleanupUploads, describeCleanup, msUntilNextRun } from "@/lib/uploads-cleanup";
import { getDb } from "@/server/db";

/**
 * The daily uploads cleanup, run by the server itself every day at 02:00 India time (no domain, secret or outside scheduler needed).
 * It always starts with the server (in production and in `npm run dev`) and only runs while the server is running at that time.
 */
export function startUploadsCleanup() {
  const g = globalThis as { __hvUploadsCleanup?: boolean };
  if (g.__hvUploadsCleanup) return; // already scheduled in this process
  g.__hvUploadsCleanup = true;

  const run = async () => {
    try {
      const report = await cleanupUploads(getDb());
      const changed = report.orphanFiles.length + report.orphanRecords.length + report.danglingRecords.length;
      if (changed || report.refused || report.failures.length || report.missingButInUse.length) console.log(`[uploads] ${describeCleanup(report)}`);
    } catch (e) {
      console.error("[uploads] cleanup failed:", e instanceof Error ? e.name : "unknown error"); // never stops the server
    }
  };
  // One timer at a time, re-aimed at the next 02:00 India time after every run.
  const schedule = () => {
    setTimeout(async () => {
      await run();
      schedule();
    }, msUntilNextRun(new Date())).unref();
  };
  schedule();
}
