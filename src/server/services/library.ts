import "server-only";
import { z } from "zod";
import { ApiError, errors } from "../errors";
import { getDb } from "../db";
import { clientIp, recordActivity } from "../audit";
import { authorize, authorizeStatusChange } from "../rbac";
import type { AuthSession } from "../auth";
import { newStorageKey, validateUpload } from "../files";
import { DOC_CATEGORY, DOC_VISIBILITY, MEDIA_FOLDERS, documents, media } from "../resources/library";
import { publishStatus, text } from "../resources/shared";
import { getStorage, type ObjectStorage } from "../storage";

/**
 * Uploads: authorize -> validate the bytes -> store the object -> write the database rows (compensating by deleting the object
 * if the database write fails). The response is a success ONLY if both the object and the metadata exist.
 */
const storageOrThrow = (): ObjectStorage => {
  const storage = getStorage();
  if (!storage) throw new ApiError(503, "storage_not_configured", "File storage is not configured on this server, so files cannot be uploaded or downloaded yet.");
  return storage;
};

/** Rejects oversized requests from the Content-Length header BEFORE the body is buffered. */
export function assertBodySize(request: Request, maxBytes: number) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new ApiError(413, "file_too_large", `The upload is too large (maximum ${Math.round(maxBytes / 1024 / 1024)} MB)`);
}

async function readForm(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw errors.invalid("The upload could not be read");
  }
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[i.path.join(".") || "_"] ??= i.message;
  return out;
}

async function persist<T>(storage: ObjectStorage, key: string, bytes: Buffer, contentType: string, write: () => Promise<T>): Promise<T> {
  try {
    await storage.put(key, bytes, { contentType });
  } catch (e) {
    console.error("[api] object storage upload failed", e instanceof Error ? e.name : "unknown");
    throw new ApiError(502, "storage_upload_failed", "The file could not be stored. Nothing was saved. Try again.");
  }
  try {
    return await write();
  } catch (e) {
    await storage.delete(key).catch(() => undefined); // do not leave an orphan object behind
    throw e;
  }
}

const mediaForm = z.object({ folder: z.enum(MEDIA_FOLDERS).default("Uploads"), altText: z.string().trim().max(200).default("") });

export async function uploadMedia(request: Request, session: AuthSession) {
  authorize(session, "media", "upload"); // before anything is read
  const storage = storageOrThrow();
  assertBodySize(request, 50 * 1024 * 1024 + 1024 * 1024);
  const form = await readForm(request);
  const file = form.get("file");
  if (!(file instanceof File)) throw errors.invalid("Choose a file to upload", { file: "Choose a file to upload" });
  const parsed = mediaForm.safeParse({ folder: form.get("folder") || undefined, altText: form.get("altText") || undefined });
  if (!parsed.success) throw errors.invalid("Some fields are invalid", fieldErrors(parsed.error));
  const v = await validateUpload(file, ["image", "video"]);
  const key = newStorageKey("media", v.ext);
  const db = getDb();
  const row = await persist(storage, key, v.bytes, v.mime, () =>
    db.$transaction(async (tx) => {
      const stored = await tx.storedFile.create({
        data: { storageKey: key, originalName: v.originalName, mimeType: v.mime, sizeBytes: BigInt(v.size), sha256: v.sha256, kind: v.kind === "video" ? "video" : "image", visibility: "private", scanStatus: "pending", uploadedById: session.user.id },
      });
      const asset = await tx.mediaAsset.create({
        data: { fileId: stored.id, name: v.originalName, altText: parsed.data.altText || v.originalName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), folder: parsed.data.folder, width: v.width ?? null, height: v.height ?? null },
        include: { file: { include: { uploadedBy: { select: { name: true } } } } },
      });
      await recordActivity(tx, { session, action: "created", entityType: media.entity, entityId: asset.id, entityLabel: v.originalName, detail: `${v.mime}, ${v.size} bytes`, ip: clientIp(request) });
      return asset;
    }),
  );
  return media.toDto(row);
}

const documentForm = z.object({
  title: text(2, 160, "Title"),
  category: z.enum(Object.keys(DOC_CATEGORY) as [keyof typeof DOC_CATEGORY, ...(keyof typeof DOC_CATEGORY)[]]),
  version: text(1, 20, "Version"),
  visibility: z.enum(["public", "internal"]).default("internal"),
  status: publishStatus.default("draft"),
});

export async function uploadDocument(request: Request, session: AuthSession) {
  authorize(session, "documents", "upload");
  const storage = storageOrThrow();
  assertBodySize(request, 10 * 1024 * 1024 + 1024 * 1024);
  const form = await readForm(request);
  const file = form.get("file");
  if (!(file instanceof File)) throw errors.invalid("Choose a file to upload", { file: "Choose a file to upload" });
  const parsed = documentForm.safeParse({ title: form.get("title") ?? "", category: form.get("category") ?? "", version: form.get("version") ?? "", visibility: form.get("visibility") || undefined, status: form.get("status") || undefined });
  if (!parsed.success) throw errors.invalid("Some fields are invalid", fieldErrors(parsed.error));
  authorizeStatusChange(session, "documents", null, parsed.data.status); // publishing needs `publish`
  const v = await validateUpload(file, ["document"]);
  const key = newStorageKey("documents", v.ext);
  const db = getDb();
  const row = await persist(storage, key, v.bytes, v.mime, () =>
    db.$transaction(async (tx) => {
      const stored = await tx.storedFile.create({
        data: { storageKey: key, originalName: v.originalName, mimeType: v.mime, sizeBytes: BigInt(v.size), sha256: v.sha256, kind: "document", visibility: DOC_VISIBILITY[parsed.data.visibility], scanStatus: "pending", uploadedById: session.user.id },
      });
      const doc = await tx.documentFile.create({
        data: { fileId: stored.id, title: parsed.data.title, category: DOC_CATEGORY[parsed.data.category], version: parsed.data.version, visibility: DOC_VISIBILITY[parsed.data.visibility], status: parsed.data.status },
        include: { file: { include: { uploadedBy: { select: { name: true } } } } },
      });
      await recordActivity(tx, { session, action: "created", entityType: documents.entity, entityId: doc.id, entityLabel: parsed.data.title, detail: `${v.mime}, ${v.size} bytes`, ip: clientIp(request) });
      return doc;
    }),
  );
  return documents.toDto(row);
}

/** Streams a media object after the permission check. Quarantined files are never served. */
export async function openMedia(session: AuthSession, id: string, asDownload: boolean) {
  authorize(session, "media", asDownload ? "download" : "view");
  const row = await getDb().mediaAsset.findUnique({ where: { id }, include: { file: true } });
  if (!row || row.file.scanStatus === "quarantined") throw errors.notFound("File");
  const storage = storageOrThrow();
  try {
    return { row, object: await storage.get(row.file.storageKey) };
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "NoSuchKey" || name === "NotFound") throw errors.notFound("File");
    console.error("[api] object storage read failed", name || "unknown");
    throw new ApiError(502, "storage_read_failed", "The file could not be read from storage.");
  }
}

/** The file of a library document, for a download after the permission check; non-public documents are audited. */
export async function documentDownload(request: Request, session: AuthSession, id: string) {
  authorize(session, "documents", "download");
  const db = getDb();
  const row = await db.documentFile.findUnique({ where: { id }, include: { file: true } });
  if (!row || row.file.scanStatus === "quarantined") throw errors.notFound("Document");
  const storage = storageOrThrow();
  let bytes: Buffer;
  try {
    bytes = Buffer.from(await new Response((await storage.get(row.file.storageKey)).stream).arrayBuffer());
  } catch (e) {
    if (e instanceof Error && e.name === "NoSuchKey") throw errors.notFound("Document");
    console.error("[api] document read failed", e instanceof Error ? e.name : "unknown");
    throw new ApiError(502, "storage_read_failed", "The file could not be read from storage.");
  }
  if (row.visibility !== "public") await recordActivity(db, { session, action: "viewed_sensitive", entityType: documents.entity, entityId: row.id, entityLabel: row.title, detail: "document downloaded", ip: clientIp(request) });
  return { fileName: row.file.originalName, mimeType: row.file.mimeType, bytes };
}
