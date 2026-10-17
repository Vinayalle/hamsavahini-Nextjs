import "server-only";
import { ApiError, errors } from "../errors";
import { getDb } from "../db";
import { clientIp, recordActivity } from "../audit";
import { authorize, authorizeAny } from "../rbac";
import type { AuthSession } from "../auth";
import { validateUpload } from "../files";
import { assertBodySize } from "./library";
import { deleteProductFile, isProductKey, newProductKey, purgeOrphanProductFiles, putProductFile, readProductFile } from "../product-files";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Upload of one product picture or document: needs the right to create or edit products, the bytes are checked (real file type, size),
 * saved to the project's local product folder, then recorded. Answers success ONLY when both the file and its record exist.
 * The returned id is what the product form keeps and sends back when the product is saved.
 */
export async function uploadProductFile(request: Request, session: AuthSession, kind: "image" | "document") {
  authorizeAny(session, "products", ["create", "edit"]); // before anything is read
  assertBodySize(request, MAX_BYTES + 512 * 1024);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw errors.invalid("The upload could not be read");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw errors.invalid("Choose a file to upload", { file: "Choose a file to upload" });
  const v = await validateUpload(file, [kind]);
  const key = newProductKey(v.ext);
  try {
    await putProductFile(key, v.bytes);
  } catch (e) {
    console.error("[api] product file could not be saved", e instanceof Error ? e.name : "unknown");
    throw new ApiError(500, "storage_upload_failed", "The file could not be saved on the server. Nothing was saved. Try again.");
  }
  const db = getDb();
  try {
    const stored = await db.$transaction(async (tx) => {
      const row = await tx.storedFile.create({
        data: { storageKey: key, originalName: v.originalName, mimeType: v.mime, sizeBytes: BigInt(v.size), sha256: v.sha256, kind, visibility: kind === "image" ? "public" : "private", scanStatus: "pending", uploadedById: session.user.id },
      });
      await recordActivity(tx, { session, action: "created", entityType: kind === "image" ? "Product image" : "Product document", entityId: row.id, entityLabel: v.originalName, detail: `${v.mime}, ${v.size} bytes`, ip: clientIp(request) });
      return row;
    });
    void purgeOrphanProductFiles(db).catch(() => undefined); // housekeeping; never delays or fails the upload
    return { id: stored.id, url: `/api/products/files/${stored.id}`, name: stored.originalName, sizeBytes: v.size };
  } catch (e) {
    await deleteProductFile(key).catch(() => undefined); // no orphan file when the record could not be written
    throw e;
  }
}

/** Admin preview or download of a product file (uploaded or saved). Needs permission to view products. */
export async function openProductFileForAdmin(session: AuthSession, fileId: string) {
  authorize(session, "products", "view");
  const file = await getDb().storedFile.findUnique({ where: { id: fileId } });
  if (!file || !isProductKey(file.storageKey) || file.scanStatus === "quarantined") throw errors.notFound("File");
  try {
    return { file, bytes: await readProductFile(file.storageKey) };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw errors.notFound("File");
    console.error("[api] product file read failed", e instanceof Error ? e.name : "unknown");
    throw new ApiError(500, "storage_read_failed", "The file could not be read.");
  }
}
