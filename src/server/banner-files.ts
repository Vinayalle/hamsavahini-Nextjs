import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { getDb } from "./db";

/**
 * Banner pictures live INSIDE the project, on local disk (default `<project>/uploads/banners`, override with BANNER_UPLOAD_DIR).
 * No bucket, no external service. The database keeps a `StoredFile` row (type, size, hash) whose key is `banners/<random>.<ext>`;
 * the bytes are only ever read back through our own routes, never served as static files, so the same validation, permission
 * and visibility rules apply as for everything else.
 */
export const BANNER_KEY_PREFIX = "banners/";
const GRACE_MS = 60 * 60 * 1000;

const rootDir = () => resolve(process.env.BANNER_UPLOAD_DIR?.trim() || join(process.cwd(), "uploads", "banners"));
/** Keys are server-generated; still, only the bare file name is ever used so a key can never point outside the folder. */
const pathOf = (key: string) => join(rootDir(), basename(key));

export const newBannerKey = (ext: string) => `${BANNER_KEY_PREFIX}${randomUUID()}.${ext}`;
export const isBannerKey = (key: string) => key.startsWith(BANNER_KEY_PREFIX);

export async function putBannerFile(key: string, bytes: Buffer) {
  await mkdir(rootDir(), { recursive: true });
  await writeFile(pathOf(key), bytes, { flag: "wx" }); // never overwrites an existing file
}
export const readBannerFile = (key: string) => readFile(pathOf(key));
export async function deleteBannerFile(key: string) {
  await unlink(pathOf(key)).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== "ENOENT") throw e;
  });
}

type Db = ReturnType<typeof getDb>;

/** Removes one banner picture (file + record) unless another banner still uses it. */
export async function removeBannerImageIfUnused(db: Db, fileId: string | null | undefined) {
  if (!fileId) return;
  if ((await db.banner.count({ where: { imageFileId: fileId } })) > 0) return;
  const file = await db.storedFile.findUnique({ where: { id: fileId } });
  if (!file || !isBannerKey(file.storageKey)) return;
  await db.storedFile.delete({ where: { id: fileId } });
  await deleteBannerFile(file.storageKey);
}

/**
 * Housekeeping: pictures that no banner uses any more (uploaded but never saved, or replaced by another picture) are deleted.
 * A one-hour grace period keeps a picture that was just uploaded into a form that has not been submitted yet.
 */
export async function purgeOrphanBannerImages(db: Db, now = new Date()) {
  const orphans = await db.storedFile.findMany({
    where: { storageKey: { startsWith: BANNER_KEY_PREFIX }, banners: { none: {} }, createdAt: { lt: new Date(now.getTime() - GRACE_MS) } },
    select: { id: true, storageKey: true },
    take: 100,
  });
  for (const o of orphans) {
    await db.storedFile.delete({ where: { id: o.id } }).catch(() => undefined);
    await deleteBannerFile(o.storageKey).catch(() => undefined);
  }
}
