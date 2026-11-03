import "server-only";
import { isProductKey, readProductFile } from "../product-files";
import { errors } from "../errors";
import { getDb } from "../db";

/** Read-only data for the PUBLIC website: only what an editor has deliberately published. */
/** The picture of a PUBLISHED product (in a published category) for the website; nothing else can be read through the public image route. */
export async function openProductImage(fileId: string) {
  const row = await getDb().productImage.findFirst({
    where: { fileId, product: { status: "published", category: { status: "published" } }, file: { kind: "image", visibility: "public", scanStatus: { not: "quarantined" } } },
    include: { file: true },
  });
  if (!row || !isProductKey(row.file.storageKey)) throw errors.notFound("Image");
  try {
    return { file: row.file, bytes: await readProductFile(row.file.storageKey) };
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") console.error("[site] product image read failed", code ?? "unknown");
    throw errors.notFound("Image");
  }
}
