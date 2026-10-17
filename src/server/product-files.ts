import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { getDb } from "./db";

/**
 * Product pictures and documents live INSIDE the project, on local disk (default `<project>/uploads/products`, override with PRODUCT_UPLOAD_DIR).
 * No bucket, no external service. The database keeps a `StoredFile` row (type, size, hash) whose key is `products/<random>.<ext>`;
 * the bytes are only ever read back through our own routes, never served as static files.
 */
export const PRODUCT_KEY_PREFIX = "products/";
const GRACE_MS = 60 * 60 * 1000;

const rootDir = () => resolve(process.env.PRODUCT_UPLOAD_DIR?.trim() || join(/*turbopackIgnore: true*/ process.cwd(), "uploads", "products"));
/** Keys are server-generated; still, only the bare file name is ever used so a key can never point outside the folder. */
const pathOf = (key: string) => join(rootDir(), basename(key));

export const newProductKey = (ext: string) => `${PRODUCT_KEY_PREFIX}${randomUUID()}.${ext}`;
export const isProductKey = (key: string) => key.startsWith(PRODUCT_KEY_PREFIX);

export async function putProductFile(key: string, bytes: Buffer) {
  await mkdir(rootDir(), { recursive: true });
  await writeFile(pathOf(key), bytes, { flag: "wx" }); // never overwrites an existing file
}
export const readProductFile = (key: string) => readFile(pathOf(key));
export async function deleteProductFile(key: string) {
  await unlink(pathOf(key)).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== "ENOENT") throw e;
  });
}

type Db = ReturnType<typeof getDb>;

/**
 * Housekeeping: files that no product uses any more (uploaded but never saved, removed from a product, or left by a deleted product)
 * are deleted. A one-hour grace period keeps a file that was just uploaded into a form that has not been submitted yet.
 */
export async function purgeOrphanProductFiles(db: Db, now = new Date()) {
  const orphans = await db.storedFile.findMany({
    where: { storageKey: { startsWith: PRODUCT_KEY_PREFIX }, productImages: { none: {} }, productDocuments: { none: {} }, createdAt: { lt: new Date(now.getTime() - GRACE_MS) } },
    select: { id: true, storageKey: true },
    take: 100,
  });
  for (const o of orphans) {
    await db.storedFile.delete({ where: { id: o.id } }).catch(() => undefined);
    await deleteProductFile(o.storageKey).catch(() => undefined);
  }
}
