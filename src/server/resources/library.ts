import "server-only";
import { z } from "zod";
import type { ResourceConfig } from "./framework";
import { iso, patchOf, pick, publishStatus, text } from "./shared";
import { getDb } from "../db";
import { getStorage } from "../storage";

/**
 * Media Library and Document Library. Records are created ONLY by the upload routes (which store the bytes first); these
 * resource configs provide list / read / edit-metadata / delete, with the same authorization as every other module.
 */
export const MEDIA_FOLDERS = ["Banners", "Locations", "Posts", "Products", "Projects", "Brand", "Uploads"] as const;
const DOC_CATEGORY = { Certificate: "certificate", Policy: "policy", Brochure: "brochure", Datasheet: "datasheet", Legal: "legal", Report: "report" } as const;
const DOC_CATEGORY_LABEL = Object.fromEntries(Object.entries(DOC_CATEGORY).map(([k, v]) => [v, k])) as Record<string, string>;
export const DOC_VISIBILITY = { public: "public", internal: "private" } as const;

const fileInclude = { file: { include: { uploadedBy: { select: { name: true } } } } } as const;

/** Removes the stored object and its metadata row once the library record is gone. */
async function removeStoredFile(fileId: string, db: ReturnType<typeof getDb>) {
  const file = await db.storedFile.findUnique({ where: { id: fileId } });
  if (!file) return;
  await db.storedFile.delete({ where: { id: fileId } });
  await getStorage()?.delete(file.storageKey);
}

export const media: ResourceConfig = {
  key: "media", permission: "media", entity: "Media file", model: "mediaAsset", include: fileInclude,
  toDto: (m) => ({
    id: m.id, name: m.name, kind: m.file.kind, mimeType: m.file.mimeType, sizeBytes: Number(m.file.sizeBytes), width: m.width ?? undefined, height: m.height ?? undefined,
    // Same-origin, permission-checked route that streams the object. The bucket itself is never exposed.
    url: `/api/media/${m.id}/file`, altText: m.altText, folder: m.folder, uploadedBy: m.file.uploadedBy?.name ?? "", createdAt: iso(m.createdAt), updatedAt: iso(m.updatedAt),
  }),
  label: (m) => m.name,
  search: ["name", "altText", "folder"], sorts: ["createdAt", "name", "updatedAt", "folder"], defaultSort: { by: "createdAt", dir: "desc" },
  filters: { kind: (v) => ({ file: { kind: v } }), folder: (v) => ({ folder: v }) },
  patchSchema: patchOf(z.object({ name: text(1, 150, "Name"), altText: z.string().trim().max(200), folder: z.enum(MEDIA_FOLDERS) })),
  buildUpdate: (p) => pick(p, { name: (v: string) => ({ name: v }), altText: (v: string) => ({ altText: v }), folder: (v: string) => ({ folder: v }) }),
  afterDelete: (row, db) => removeStoredFile(row.fileId, db as ReturnType<typeof getDb>),
};

export const documents: ResourceConfig = {
  key: "documents", permission: "documents", entity: "Document", model: "documentFile", include: fileInclude,
  toDto: (d) => ({
    id: d.id, title: d.title, category: DOC_CATEGORY_LABEL[d.category], fileName: d.file.originalName, mimeType: d.file.mimeType, sizeBytes: Number(d.file.sizeBytes), version: d.version,
    visibility: d.visibility === "public" ? "public" : "internal", uploadedBy: d.file.uploadedBy?.name ?? "", status: d.status, createdAt: iso(d.createdAt), updatedAt: iso(d.updatedAt),
  }),
  label: (d) => d.title,
  search: ["title", "version"], sorts: ["updatedAt", "createdAt", "title", "category", "status"], defaultSort: { by: "updatedAt", dir: "desc" },
  filters: {
    status: (v) => ({ status: v }),
    category: (v) => (v in DOC_CATEGORY ? { category: DOC_CATEGORY[v as keyof typeof DOC_CATEGORY] } : undefined),
    visibility: (v) => (v === "public" ? { visibility: "public" } : v === "internal" ? { visibility: { not: "public" } } : undefined),
  },
  patchSchema: patchOf(z.object({
    title: text(2, 160, "Title"), category: z.enum(Object.keys(DOC_CATEGORY) as [keyof typeof DOC_CATEGORY, ...(keyof typeof DOC_CATEGORY)[]]),
    version: text(1, 20, "Version"), visibility: z.enum(["public", "internal"]), status: publishStatus,
  })),
  buildUpdate: (p) => pick(p, {
    title: (v: string) => ({ title: v }), category: (v: keyof typeof DOC_CATEGORY) => ({ category: DOC_CATEGORY[v] }), version: (v: string) => ({ version: v }),
    visibility: (v: "public" | "internal") => ({ visibility: DOC_VISIBILITY[v], file: { update: { visibility: DOC_VISIBILITY[v] } } }), status: (v: string) => ({ status: v }),
  }),
  status: { field: "status", mode: "publish", values: ["draft", "published", "archived"] },
  afterDelete: (row, db) => removeStoredFile(row.fileId, db as ReturnType<typeof getDb>),
};

export { DOC_CATEGORY };
