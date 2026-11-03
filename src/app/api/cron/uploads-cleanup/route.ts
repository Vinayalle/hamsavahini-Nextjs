import { timingSafeEqual } from "node:crypto";
import { cleanupUploads } from "@/lib/uploads-cleanup";
import { ApiError } from "@/server/errors";
import { getDb } from "@/server/db";
import { json, route } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Called on a schedule by Supabase Cron (pg_cron + pg_net): deletes uploaded files that nothing uses any more.
 * See src/lib/uploads-cleanup.ts for exactly what is deleted and how it stays safe, and docs/operations.md for the Supabase job.
 *
 * It is not a browser endpoint: it has no session and no Origin check. Instead the request must carry
 *   Authorization: Bearer <CRON_SECRET>
 * CRON_SECRET is set only in the server's environment. Without it the address answers 404 (as if it did not exist); a missing or
 * wrong secret answers 401 and does nothing. Add ?dryRun=1 to see what would be deleted without deleting anything.
 */
const equal = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

let running = false; // two overlapping runs would only race over the same files

export const POST = route(async (request) => {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) throw new ApiError(404, "not_found", "Not found");
  const given = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!given || !equal(given, secret)) throw new ApiError(401, "unauthorized", "Unauthorized");
  if (running) return json({ ok: true, skipped: "a cleanup is already running" });
  running = true;
  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const r = await cleanupUploads(getDb(), { dryRun });
    // Counts only: the file names are random ids, but a scheduler's log has no use for them.
    return json({
      ok: !r.refused && r.failures.length === 0, dryRun: r.dryRun, scannedFiles: r.scannedFiles, inUse: r.inUse, tooRecent: r.tooRecent,
      deletedFiles: r.orphanFiles.length, deletedUnusedRecords: r.orphanRecords.length, deletedLeftoverRecords: r.danglingRecords.length,
      missingButInUse: r.missingButInUse.length, truncated: r.truncated, refused: r.refused, failures: r.failures.length,
    });
  } finally {
    running = false;
  }
}, { machine: true });
