import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getDb } from "@/server/db";
import { cleanupUploads, describeCleanup, msUntilNextRun } from "@/lib/uploads-cleanup";

/**
 * The uploads cleanup: files nothing uses are deleted, everything in use and everything too young to judge is left alone,
 * and a database that does not match the folder is never allowed to wipe it.
 */
const db = () => getDb();
const HOUR = 3_600_000;
const saved: Record<string, string | undefined> = {};
let root = "";
const ENV = ["UPLOAD_DIR", "PRODUCT_UPLOAD_DIR"] as const;

/** Writes a file named like the app names uploads, optionally "aged" so it counts as old. */
function put(key: string, ageHours = 48): string {
  const path = join(root, key);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, "x");
  const t = new Date(Date.now() - ageHours * HOUR);
  utimesSync(path, t, t);
  return path;
}
/** Removes only records nothing uses (other test files share this database and may own some). */
const clearUnusedRows = () =>
  db().storedFile.deleteMany({
    where: {
      OR: ["media/", "documents/", "resumes/", "products/"].map((p) => ({ storageKey: { startsWith: p } })),
      mediaAsset: null, libraryDocument: null, profileImageOf: { none: {} }, postCovers: { none: {} },
      applications: { none: {} }, productImages: { none: {} }, productDocuments: { none: {} },
    },
  });
const id = (ext: string) => `${randomUUID()}.${ext}`;
const row = (key: string, ageHours = 48) =>
  db().storedFile.create({ data: { storageKey: key, originalName: "f", mimeType: "image/png", sizeBytes: BigInt(1), kind: "image", visibility: "private", createdAt: new Date(Date.now() - ageHours * HOUR) } });

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  root = mkdtempSync(join(tmpdir(), "hv-cleanup-"));
  process.env.UPLOAD_DIR = root;
  process.env.PRODUCT_UPLOAD_DIR = join(root, "products");
});
afterAll(async () => {
  rmSync(root, { recursive: true, force: true });
  for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  await db().mediaAsset.deleteMany({ where: { name: { in: ["in use", "broken but used", "the one that matches"] } } });
  await clearUnusedRows();
});
beforeEach(async () => {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  await db().mediaAsset.deleteMany({ where: { name: { in: ["in use", "broken but used", "the one that matches"] } } }); // only the ones this file made
  await clearUnusedRows();
});

describe("uploads cleanup", () => {
  it("deletes files that have no record, in every uploads folder", async () => {
    const files = [put(`media/2026/${id("png")}`), put(`documents/2026/${id("pdf")}`), put(`resumes/2026/${id("pdf")}`), put(`products/${id("png")}`)];
    const r = await cleanupUploads(db());
    expect(r.orphanFiles).toHaveLength(4);
    for (const f of files) expect(existsSync(f)).toBe(false);
    expect(r.refused).toBeUndefined();
  });

  it("deletes an unused record together with its file, but keeps anything that is in use", async () => {
    const unusedKey = `documents/2026/${id("pdf")}`;
    const usedKey = `media/2026/${id("png")}`;
    const unused = put(unusedKey);
    const used = put(usedKey);
    await row(unusedKey);
    const usedRow = await row(usedKey);
    await db().mediaAsset.create({ data: { fileId: usedRow.id, name: "in use" } });
    const r = await cleanupUploads(db());
    expect(r.orphanRecords).toEqual([unusedKey]);
    expect(existsSync(unused)).toBe(false);
    expect(await db().storedFile.count({ where: { storageKey: unusedKey } })).toBe(0);
    expect(existsSync(used)).toBe(true);
    expect(await db().storedFile.count({ where: { storageKey: usedKey } })).toBe(1);
    expect(r.inUse).toBe(1);
  });

  it("leaves recent files alone: an upload may still be in progress", async () => {
    const fresh = put(`media/2026/${id("png")}`, 0);
    const freshRowKey = `products/${id("png")}`;
    const freshRowFile = put(freshRowKey, 0);
    await row(freshRowKey, 0);
    const r = await cleanupUploads(db());
    expect(existsSync(fresh)).toBe(true);
    expect(existsSync(freshRowFile)).toBe(true);
    expect(r.tooRecent).toBe(2);
    expect(r.orphanFiles).toEqual([]);
    const later = await cleanupUploads(db(), { now: new Date(Date.now() + 48 * HOUR) }); // a day or two later they count as old
    expect(later.orphanFiles).toHaveLength(1);
    expect(existsSync(fresh)).toBe(false);
  });

  it("never touches files that are not named like uploads", async () => {
    const odd = [put("notes.txt"), put("media/readme.txt"), put("media/2026/not-a-uuid.png"), put("other/stuff.png")];
    const r = await cleanupUploads(db());
    expect(r.scannedFiles).toBe(0);
    for (const f of odd) expect(existsSync(f)).toBe(true);
  });

  it("a dry run reports what would go and deletes nothing", async () => {
    const f = put(`products/${id("png")}`);
    const key = `media/2026/${id("png")}`;
    const g = put(key);
    await row(key);
    const r = await cleanupUploads(db(), { dryRun: true });
    expect(r.dryRun).toBe(true);
    expect(r.orphanFiles).toHaveLength(1);
    expect(r.orphanRecords).toEqual([key]);
    expect(existsSync(f) && existsSync(g)).toBe(true);
    expect(await db().storedFile.count({ where: { storageKey: key } })).toBe(1);
    expect(describeCleanup(r)).toMatch(/dry run[\s\S]*would delete 1 files with no record, 1 unused/);
  });

  it("removes a leftover record whose file is gone, but only reports one that is still in use", async () => {
    const goneKey = `media/2026/${id("png")}`;
    const usedKey = `media/2026/${id("png")}`;
    await row(goneKey);
    const usedRow = await row(usedKey);
    await db().mediaAsset.create({ data: { fileId: usedRow.id, name: "broken but used" } });
    const r = await cleanupUploads(db());
    expect(r.danglingRecords).toContain(goneKey);
    expect(r.missingButInUse).toContain(usedKey);
    expect(await db().storedFile.count({ where: { storageKey: goneKey } })).toBe(0);
    expect(await db().storedFile.count({ where: { storageKey: usedKey } })).toBe(1);
  });

  it("refuses to delete when most of the folder looks orphaned (the wrong database), unless forced", async () => {
    const files = Array.from({ length: 12 }, () => put(`media/2026/${id("png")}`));
    const keepKey = `media/2026/${id("png")}`;
    put(keepKey);
    const k = await row(keepKey);
    await db().mediaAsset.create({ data: { fileId: k.id, name: "the one that matches" } });
    const refused = await cleanupUploads(db());
    expect(refused.refused).toMatch(/wrong database/);
    expect(files.every((f) => existsSync(f))).toBe(true);
    const forced = await cleanupUploads(db(), { force: true });
    expect(forced.refused).toBeUndefined();
    expect(files.some((f) => existsSync(f))).toBe(false);
  });

  it("stops at the per-run limit and carries on the next time", async () => {
    for (let i = 0; i < 5; i++) put(`products/${id("png")}`);
    const first = await cleanupUploads(db(), { maxDeletes: 3, force: true });
    expect(first.orphanFiles).toHaveLength(3);
    expect(first.truncated).toBe(true);
    const second = await cleanupUploads(db(), { maxDeletes: 3, force: true });
    expect(second.orphanFiles).toHaveLength(2);
    expect(second.truncated).toBe(false);
  });
});

describe("the daily 02:00 India time schedule (UTC+5:30, whatever the server's own time zone is)", () => {
  const utc = (h: number, m = 0, s = 0) => new Date(Date.UTC(2026, 5, 15, h, m, s));
  it("fires at 20:30 UTC, which is 02:00 in India", () => {
    expect(msUntilNextRun(utc(20, 0))).toBe(30 * 60_000);
    expect(msUntilNextRun(utc(20, 29, 59))).toBe(1000);
    expect(msUntilNextRun(utc(20, 30))).toBe(24 * HOUR); // exactly on time means the next one is tomorrow
    expect(msUntilNextRun(utc(20, 31))).toBe(24 * HOUR - 60_000);
    expect(msUntilNextRun(utc(0, 0))).toBe(20 * HOUR + 30 * 60_000);
    expect(msUntilNextRun(utc(2, 0))).toBe(18 * HOUR + 30 * 60_000);
  });
  it("is always inside the next 24 hours, at every minute of the day", () => {
    for (let m = 0; m < 1440; m += 7) {
      const ms = msUntilNextRun(utc(Math.floor(m / 60), m % 60));
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(24 * HOUR);
    }
  });
  it("other hours and offsets work too (for example 03:15 UTC+0)", () => {
    expect(msUntilNextRun(utc(3, 0), 3, 15, 0)).toBe(15 * 60_000);
  });
});
