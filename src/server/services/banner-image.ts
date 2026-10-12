import "server-only";
import { ApiError, errors } from "../errors";
import { getDb } from "../db";
import { clientIp, recordActivity } from "../audit";
import { authorize, authorizeAny } from "../rbac";
import type { AuthSession } from "../auth";
import { validateUpload } from "../files";
import { assertBodySize } from "./library";
import { isBannerKey, newBannerKey, purgeOrphanBannerImages, putBannerFile, readBannerFile, deleteBannerFile } from "../banner-files";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload of a banner picture: needs the right to create or edit banners, the bytes are checked (real image type, size), saved to the
 * project's local banner folder, then recorded. Answers success ONLY when both the file and its record exist.
 */
export async function uploadBannerImage(request: Request, session: AuthSession) {
  authorizeAny(session, "banners", ["create", "edit"]); // before anything is read
  assertBodySize(request, MAX_BYTES + 512 * 1024);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw errors.invalid("The upload could not be read");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw errors.invalid("Choose an image to upload", { file: "Choose an image to upload" });
  const v = await validateUpload(file, ["image"]);
  const key = newBannerKey(v.ext);
  try {
    await putBannerFile(key, v.bytes);
  } catch (e) {
    console.error("[api] banner image could not be saved", e instanceof Error ? e.name : "unknown");
    throw new ApiError(500, "storage_upload_failed", "The image could not be saved on the server. Nothing was saved. Try again.");
  }
  const db = getDb();
  try {
    const stored = await db.$transaction(async (tx) => {
      const row = await tx.storedFile.create({
        data: { storageKey: key, originalName: v.originalName, mimeType: v.mime, sizeBytes: BigInt(v.size), sha256: v.sha256, kind: "image", visibility: "public", scanStatus: "pending", uploadedById: session.user.id },
      });
      await recordActivity(tx, { session, action: "created", entityType: "Banner image", entityId: row.id, entityLabel: v.originalName, detail: `${v.mime}, ${v.size} bytes`, ip: clientIp(request) });
      return row;
    });
    void purgeOrphanBannerImages(db).catch(() => undefined); // housekeeping; never delays or fails the upload
    return { id: stored.id, url: `/api/banners/image/${stored.id}`, name: stored.originalName, width: v.width ?? null, height: v.height ?? null };
  } catch (e) {
    await deleteBannerFile(key).catch(() => undefined); // no orphan file when the record could not be written
    throw e;
  }
}

/** Admin preview of a banner picture (uploaded or saved). Needs permission to view banners. */
export async function openBannerImageForAdmin(session: AuthSession, fileId: string) {
  authorize(session, "banners", "view");
  const file = await getDb().storedFile.findUnique({ where: { id: fileId } });
  if (!file || file.kind !== "image" || !isBannerKey(file.storageKey) || file.scanStatus === "quarantined") throw errors.notFound("Image");
  try {
    return { file, bytes: await readBannerFile(file.storageKey) };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw errors.notFound("Image");
    console.error("[api] banner image read failed", e instanceof Error ? e.name : "unknown");
    throw new ApiError(500, "storage_read_failed", "The image could not be read.");
  }
}
