import { readdir, stat, unlink } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import type { PrismaClient } from "../generated/prisma/client";
import { productDir, uploadRoot } from "./upload-dirs";

/**
 * UPLOADS CLEANUP. Finds files in the uploads folders that nothing uses any more and deletes them:
 *
 *   1. a file on disk with NO database record                          -> the record was deleted (or never written): delete the file
 *   2. a file with a record that NO product / media item /
 *      document / job application / article / user points at          -> delete the file and the record
 *   3. a record whose file is missing from disk and that nothing uses  -> delete the leftover record
 *      (a missing file that something DOES use is only reported: the page that shows it needs a new upload)
 *
 * Safety: only files named like the app names them (random id + extension, in the known folders) are ever looked at; files younger than
 * `minAgeMs` (default 24 h) are left alone because an upload may still be in progress; at most `maxDeletes` per run; and if more than half
 * of what it found would go, it refuses (that usually means the wrong database is configured) unless `force` is set.
 * No server-only import: the same code runs from the scheduler inside the server and from `npm run uploads:cleanup`.
 */
export interface CleanupOptions {
  /** Report what would be deleted, delete nothing. */
  dryRun?: boolean;
  /** Leave anything newer than this alone. Default 24 hours. */
  minAgeMs?: number;
  /** Stop after this many deletions in one run. Default 500. */
  maxDeletes?: number;
  /** Skip the "looks like the wrong database" check. */
  force?: boolean;
  now?: Date;
}

export interface CleanupReport {
  dryRun: boolean;
  scannedFiles: number;
  inUse: number;
  tooRecent: number;
  /** Files with no record (deleted, or would be in a dry run). */
  orphanFiles: string[];
  /** Records nothing uses, with their files (deleted, or would be). */
  orphanRecords: string[];
  /** Records whose file is gone and that nothing uses (deleted, or would be). */
  danglingRecords: string[];
  /** Records something still uses but whose file is missing: nothing is deleted, they need a new upload. */
  missingButInUse: string[];
  failures: string[];
  truncated: boolean;
  /** Set when the run stopped without deleting anything, and why. */
  refused?: string;
}

const STORAGE_KEY = /^(media|documents|resumes)\/(\d{4}\/)?[0-9a-f-]{8,40}\.[a-z0-9]{1,8}$/;
const OWN_KEY = /^products\/[0-9a-f-]{8,40}\.[a-z0-9]{1,8}$/;
const isManagedKey = (key: string) => STORAGE_KEY.test(key) || OWN_KEY.test(key);
const MANAGED_PREFIXES = ["media/", "documents/", "resumes/", "products/"];

interface DiskFile { key: string; path: string; mtimeMs: number }

async function walk(dir: string, skip: Set<string>): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return []; // the folder does not exist yet
  }
  const out: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (!skip.has(resolve(full))) out.push(...(await walk(full, skip)));
    } else if (e.isFile()) out.push(full);
  }
  return out;
}

async function scanDisk(): Promise<DiskFile[]> {
  const products = productDir();
  const root = uploadRoot();
  const roots: { dir: string; prefix: string; skip: Set<string> }[] = [
    { dir: products, prefix: "products/", skip: new Set() },
    { dir: root, prefix: "", skip: new Set([resolve(products)]) },
  ];
  const found = new Map<string, DiskFile>();
  for (const r of roots) {
    for (const path of await walk(r.dir, r.skip)) {
      const key = r.prefix + relative(r.dir, path).split(sep).join("/");
      if (!isManagedKey(key) || found.has(key)) continue; // anything not named like an upload is never touched
      const s = await stat(path).catch(() => null);
      if (s) found.set(key, { key, path, mtimeMs: s.mtimeMs });
    }
  }
  return [...found.values()];
}

const ownerSelect = {
  id: true, storageKey: true, createdAt: true,
  mediaAsset: { select: { id: true } }, libraryDocument: { select: { id: true } },
  _count: { select: { profileImageOf: true, postCovers: true, applications: true, productImages: true, productDocuments: true } },
} as const;
type Row = { id: string; storageKey: string; createdAt: Date; mediaAsset: { id: string } | null; libraryDocument: { id: string } | null; _count: Record<string, number> };
const inUse = (r: Row) => !!r.mediaAsset || !!r.libraryDocument || Object.values(r._count).some((n) => n > 0);

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function cleanupUploads(db: PrismaClient, options: CleanupOptions = {}): Promise<CleanupReport> {
  const now = (options.now ?? new Date()).getTime();
  const minAge = options.minAgeMs ?? 24 * 60 * 60 * 1000;
  const maxDeletes = options.maxDeletes ?? 500;
  const dryRun = !!options.dryRun;
  const report: CleanupReport = { dryRun, scannedFiles: 0, inUse: 0, tooRecent: 0, orphanFiles: [], orphanRecords: [], danglingRecords: [], missingButInUse: [], failures: [], truncated: false };

  const files = await scanDisk();
  report.scannedFiles = files.length;
  const onDisk = new Set(files.map((f) => f.key));

  // 1 + 2: every file on disk against its record
  const rows = new Map<string, Row>();
  for (const part of chunks(files.map((f) => f.key), 500)) {
    for (const r of (await db.storedFile.findMany({ where: { storageKey: { in: part } }, select: ownerSelect })) as Row[]) rows.set(r.storageKey, r);
  }
  const orphanFiles: DiskFile[] = [];
  const orphanRecords: { file: DiskFile; row: Row }[] = [];
  for (const f of files) {
    const row = rows.get(f.key);
    if (!row) {
      if (now - f.mtimeMs >= minAge) orphanFiles.push(f); else report.tooRecent++;
    } else if (inUse(row)) {
      report.inUse++;
    } else if (now - Math.max(f.mtimeMs, row.createdAt.getTime()) >= minAge) {
      orphanRecords.push({ file: f, row });
    } else report.tooRecent++;
  }

  // 3: records whose file is gone
  const dangling: Row[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = (await db.storedFile.findMany({
      where: { OR: MANAGED_PREFIXES.map((p) => ({ storageKey: { startsWith: p } })) },
      select: ownerSelect, orderBy: { id: "asc" }, take: 1000, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })) as Row[];
    if (page.length === 0) break;
    cursor = page[page.length - 1].id;
    for (const r of page) {
      if (onDisk.has(r.storageKey) || !isManagedKey(r.storageKey)) continue;
      if (inUse(r)) report.missingButInUse.push(r.storageKey);
      else if (now - r.createdAt.getTime() >= minAge) dangling.push(r);
    }
    if (page.length < 1000) break;
  }

  // Looks like the wrong database? (a different database would make every file look like an orphan)
  const candidates = orphanFiles.length + orphanRecords.length;
  if (!options.force && candidates >= 10 && candidates > files.length / 2) {
    report.refused = `${candidates} of ${files.length} files would be deleted. That looks like the wrong database is configured, so nothing was deleted. Check DATABASE_URL, or run with --force if it is really right.`;
    report.orphanFiles = orphanFiles.map((f) => f.key);
    report.orphanRecords = orphanRecords.map((o) => o.file.key);
    report.danglingRecords = dangling.map((r) => r.storageKey);
    return report;
  }

  let budget = maxDeletes;
  const take = () => { if (budget <= 0) { report.truncated = true; return false; } budget--; return true; };
  const removeFile = async (path: string) => { await unlink(path).catch((e: NodeJS.ErrnoException) => { if (e.code !== "ENOENT") throw e; }); };

  for (const f of orphanFiles) {
    if (!take()) break;
    try { if (!dryRun) await removeFile(f.path); report.orphanFiles.push(f.key); } catch (e) { report.failures.push(`${f.key}: ${(e as Error).message}`); }
  }
  for (const { file, row } of orphanRecords) {
    if (!take()) break;
    try {
      if (!dryRun) { await removeFile(file.path); await db.storedFile.delete({ where: { id: row.id } }); }
      report.orphanRecords.push(file.key);
    } catch (e) { report.failures.push(`${file.key}: ${(e as Error).message}`); }
  }
  for (const r of dangling) {
    if (!take()) break;
    try { if (!dryRun) await db.storedFile.delete({ where: { id: r.id } }); report.danglingRecords.push(r.storageKey); } catch (e) { report.failures.push(`${r.storageKey}: ${(e as Error).message}`); }
  }
  return report;
}

/** One readable paragraph for the console or a log. Lists only names of files (random ids), never contents. */
export function describeCleanup(r: CleanupReport): string {
  const verb = r.dryRun ? "would delete" : "deleted";
  const lines = [
    `Uploads cleanup${r.dryRun ? " (dry run)" : ""}: looked at ${r.scannedFiles} files; ${r.inUse} in use, ${r.tooRecent} too recent to judge.`,
    `  ${verb} ${r.orphanFiles.length} files with no record, ${r.orphanRecords.length} unused files with their records, ${r.danglingRecords.length} records whose file was gone.`,
  ];
  if (r.missingButInUse.length) lines.push(`  ${r.missingButInUse.length} records are still in use but their file is missing from disk (re-upload needed): ${r.missingButInUse.slice(0, 5).join(", ")}${r.missingButInUse.length > 5 ? " ..." : ""}`);
  if (r.truncated) lines.push("  stopped at the per-run limit; the next run continues.");
  if (r.refused) lines.push(`  REFUSED: ${r.refused}`);
  for (const f of r.failures.slice(0, 5)) lines.push(`  failed: ${f}`);
  return lines.join("\n");
}

/**
 * Milliseconds from `now` until the next `hour`:`minute` on a clock that is `offsetMinutes` ahead of UTC (default 02:00 India time,
 * UTC+5:30, which has no daylight-saving changes). It does not depend on the time zone the server runs in. Always between 1 ms and 24 h.
 */
export function msUntilNextRun(now: Date, hour = 2, minute = 0, offsetMinutes = 330): number {
  const DAY = 86_400_000;
  const targetUtcMinute = (((hour * 60 + minute - offsetMinutes) % 1440) + 1440) % 1440;
  const nowMs = now.getTime();
  let next = nowMs - (nowMs % DAY) + targetUtcMinute * 60_000;
  if (next <= nowMs) next += DAY;
  return next - nowMs;
}
