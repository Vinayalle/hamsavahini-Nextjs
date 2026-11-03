import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "../db";
import { recordActivity } from "../audit";
import type { AuthSession } from "../auth";
import { errors } from "../errors";
import { patchOf } from "../resources/shared";
import { authorize, authorizeBulkStatus, authorizeStatusChange } from "../rbac";
import { publishStatus } from "./categories";
import { filesOfProducts, isProductKey, purgeOrphanProductFiles, removeUnusedProductFiles } from "../product-files";

const slug = z.string().trim().min(2, "Slug is required").max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");

const specInput = z.object({
  label: z.string().trim().min(1, "Required").max(80),
  value: z.string().trim().min(1, "Required").max(120),
  unit: z.string().trim().max(30).optional().nullable(),
});

/**
 * Images and documents are attached by file id only. A file id exists only after an authorised, validated upload through
 * /api/products/image or /api/products/document (saved inside the project); the client cannot name an arbitrary file or path.
 */
const imageInput = z.object({ fileId: z.uuid(), alt: z.string().trim().max(160).default(""), isPrimary: z.boolean().default(false) });
const documentInput = z.object({ fileId: z.uuid(), type: z.enum(["datasheet", "coa", "msds", "brochure", "other"]).default("other") });
export const productInput = z.object({
  name: z.string().trim().min(2, "Product name is required").max(160),
  /** Optional: made automatically (P-XXXXXXXX) when a product is added without one. */
  code: z.string().trim().min(3, "Product code is required").max(40).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and hyphens only").transform((v) => v.toUpperCase()).optional(),
  /** Optional: made from the name (and kept unique) when a product is added without one. */
  slug: slug.optional(),
  categoryId: z.uuid("Choose a category"),
  /** Optional: taken from the start of the full description. */
  shortDescription: z.string().trim().min(10, "Add a short summary (min 10 characters)").max(200, "Keep it under 200 characters").optional(),
  description: z.string().trim().min(20, "Add the product details (min 20 characters)").max(20000),
  /** What the product is used for, or the industries it serves. Shown on the product card and the product page. */
  applications: z.array(z.string().trim().min(1).max(80)).max(12, "Up to 12 entries").optional(),
  /** Where it comes from, for example India / Brazil. Shown with a pin on the product card. */
  origin: z.string().trim().max(120).nullish().transform((v) => (v ? v : null)),
  specifications: z.array(specInput).max(60).default([]),
  images: z.array(imageInput).max(8, "Up to 8 images").optional(),
  documents: z.array(documentInput).max(20, "Up to 20 documents").optional(),
  /** Optional: a new product is shown on the website (published) unless the caller cannot publish, then it starts hidden (draft). */
  status: publishStatus.optional(),
  featured: z.boolean().default(false),
});
export const productPatch = patchOf(productInput);
export type ProductInput = z.infer<typeof productInput>;

export const productListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: z.uuid().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  featured: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.enum(["name", "code", "status", "featured", "updatedAt", "createdAt"]).default("updatedAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

const include = {
  specifications: { orderBy: { sortOrder: "asc" as const } },
  images: { orderBy: { sortOrder: "asc" as const }, include: { file: true } },
  documents: { include: { file: true } },
} satisfies Prisma.ProductInclude;
type ProductRow = Prisma.ProductGetPayload<{ include: typeof include }>;

export function toProductDto(p: ProductRow) {
  return {
    id: p.id, name: p.name, slug: p.slug, code: p.code, categoryId: p.categoryId,
    shortDescription: p.shortDescription, description: p.description, applications: p.applications, origin: p.origin,
    // The admin previews files through the permission-checked route; fileId is what a save sends back.
    images: p.images.filter((i) => i.file.scanStatus !== "quarantined").map((i) => ({ id: i.id, fileId: i.fileId, url: `/api/products/files/${i.fileId}`, alt: i.alt, isPrimary: i.isPrimary })),
    specifications: p.specifications.map((s) => ({ id: s.id, label: s.label, value: s.value, unit: s.unit ?? undefined })),
    documents: p.documents.map((d) => ({ id: d.id, fileId: d.fileId, url: `/api/products/files/${d.fileId}`, name: d.file.originalName, type: d.type, sizeBytes: Number(d.file.sizeBytes) })),
    status: p.status, featured: p.featured, publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
  };
}

/** Every attached file must be a product file that was uploaded through the upload routes, of the right kind. */
async function assertFiles(images?: { fileId: string }[], documents?: { fileId: string }[]) {
  const db = getDb();
  const check = async (ids: string[], kind: "image" | "document", field: "images" | "documents") => {
    if (new Set(ids).size !== ids.length) throw errors.invalid("The same file is attached twice", { [field]: "The same file is attached twice" });
    if (!ids.length) return;
    const rows = await db.storedFile.findMany({ where: { id: { in: ids } }, select: { id: true, kind: true, storageKey: true } });
    const ok = rows.length === ids.length && rows.every((r) => r.kind === kind && isProductKey(r.storageKey));
    if (!ok) throw errors.invalid("A file is missing or not allowed. Upload it again.", { [field]: "A file is missing or not allowed. Upload it again." });
  };
  await check((images ?? []).map((i) => i.fileId), "image", "images");
  await check((documents ?? []).map((d) => d.fileId), "document", "documents");
}

/** Exactly one primary picture when there is any picture: the first marked one, else the first. */
function normaliseImages<T extends { isPrimary: boolean }>(images: T[]): T[] {
  const primary = Math.max(0, images.findIndex((i) => i.isPrimary));
  return images.map((i, idx) => ({ ...i, isPrimary: idx === primary }));
}

/** URL piece made from a product name: lowercase letters, numbers and single hyphens. */
const slugBase = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "") || "product";
async function uniqueSlug(base: string): Promise<string> {
  const db = getDb();
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!(await db.product.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
}
async function newCode(): Promise<string> {
  const db = getDb();
  for (;;) {
    const code = `P-${randomBytes(4).toString("hex").toUpperCase()}`;
    if (!(await db.product.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
}
/** The first part of the details, cut at a word, for page descriptions and search results. */
export function summarise(description: string): string {
  const flat = description.replace(/\s+/g, " ").trim();
  if (flat.length <= 200) return flat;
  const cut = flat.slice(0, 197);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 120))}…`;
}

function assertUniqueSpecs(specs: { label: string }[]) {
  const seen = new Set<string>();
  for (const s of specs) {
    const k = s.label.trim().toLowerCase();
    if (seen.has(k)) throw errors.invalid("Duplicate specification", { specifications: `“${s.label}” appears more than once` });
    seen.add(k);
  }
}

async function assertRefs(input: Partial<ProductInput>, selfId?: string) {
  const db = getDb();
  if (input.categoryId && !(await db.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }))) {
    throw errors.invalid("Category does not exist", { categoryId: "Category does not exist" });
  }
  if (input.code) {
    const dup = await db.product.findUnique({ where: { code: input.code }, select: { id: true } });
    if (dup && dup.id !== selfId) throw errors.conflict("Another product already uses this code", { code: "Another product already uses this code" });
  }
  if (input.slug) {
    const dup = await db.product.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (dup && dup.id !== selfId) throw errors.conflict("Another product already uses this slug", { slug: "Another product already uses this slug" });
  }
}

export async function listProducts(session: AuthSession, q: z.infer<typeof productListQuery>) {
  authorize(session, "products", "view");
  const where: Prisma.ProductWhereInput = {
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.featured ? { featured: q.featured === "true" } : {}),
    ...(q.search ? { OR: [{ name: { contains: q.search, mode: "insensitive" } }, { code: { contains: q.search, mode: "insensitive" } }, { shortDescription: { contains: q.search, mode: "insensitive" } }] } : {}),
  };
  const db = getDb();
  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({ where, include, orderBy: { [q.sortBy]: q.sortDir }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  return { items: rows.map(toProductDto), total, page: q.page, pageSize: q.pageSize, pageCount: Math.max(1, Math.ceil(total / q.pageSize)) };
}

export async function getProduct(session: AuthSession, id: string) {
  authorize(session, "products", "view");
  const row = await getDb().product.findUnique({ where: { id }, include });
  if (!row) throw errors.notFound("Product");
  return toProductDto(row);
}

export async function createProduct(session: AuthSession, input: ProductInput, ip: string | null) {
  authorize(session, "products", "create");
  // Shown on the website straight away, unless this person is not allowed to publish: then it starts hidden and someone who can publish switches it on.
  let status = input.status;
  if (!status) {
    try {
      authorizeStatusChange(session, "products", null, "published");
      status = "published";
    } catch {
      status = "draft";
    }
  }
  authorizeStatusChange(session, "products", null, status);
  const specs = input.specifications;
  assertUniqueSpecs(specs);
  const resolved = {
    ...input, status,
    code: input.code ?? (await newCode()),
    slug: input.slug ?? (await uniqueSlug(slugBase(input.name))),
    shortDescription: input.shortDescription ?? summarise(input.description),
  };
  await assertRefs(resolved);
  await assertFiles(input.images, input.documents);
  const { specifications, images, documents, ...rest } = resolved;
  return getDb().$transaction(async (tx) => {
    const row = await tx.product.create({
      data: {
        ...rest,
        publishedAt: status === "published" ? new Date() : null,
        specifications: { create: specifications.map((s, i) => ({ label: s.label, value: s.value, unit: s.unit || null, sortOrder: i })) },
        images: { create: normaliseImages(images ?? []).map((i, n) => ({ fileId: i.fileId, alt: i.alt, isPrimary: i.isPrimary, sortOrder: n })) },
        documents: { create: (documents ?? []).map((d) => ({ fileId: d.fileId, type: d.type })) },
      },
      include,
    });
    await recordActivity(tx, { session, action: "created", entityType: "Product", entityId: row.id, entityLabel: row.name, ip });
    return toProductDto(row);
  });
}

export async function updateProduct(session: AuthSession, id: string, patch: Partial<ProductInput>, ip: string | null) {
  authorize(session, "products", "edit");
  const db = getDb();
  const current = await db.product.findUnique({ where: { id } });
  if (!current) throw errors.notFound("Product");
  if (patch.status) authorizeStatusChange(session, "products", current.status, patch.status);
  if (patch.specifications) assertUniqueSpecs(patch.specifications);
  await assertRefs(patch, id);
  await assertFiles(patch.images, patch.documents);
  const { specifications, images, documents, ...rest } = patch;
  if (patch.description !== undefined && patch.shortDescription === undefined) rest.shortDescription = summarise(patch.description);
  const statusChanged = patch.status !== undefined && patch.status !== current.status;
  const previousFiles = images || documents ? await filesOfProducts(db, [id]) : [];

  return db.$transaction(async (tx) => {
    if (specifications) {
      // Replace the set: the admin edits the whole list at once.
      await tx.productSpecification.deleteMany({ where: { productId: id } });
      await tx.productSpecification.createMany({ data: specifications.map((s, i) => ({ productId: id, label: s.label, value: s.value, unit: s.unit || null, sortOrder: i })) });
    }
    if (images) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({ data: normaliseImages(images).map((i, n) => ({ productId: id, fileId: i.fileId, alt: i.alt, isPrimary: i.isPrimary, sortOrder: n })) });
    }
    if (documents) {
      await tx.productDocument.deleteMany({ where: { productId: id } });
      await tx.productDocument.createMany({ data: documents.map((d) => ({ productId: id, fileId: d.fileId, type: d.type })) });
    }
    const row = await tx.product.update({
      where: { id },
      data: {
        ...rest,
        ...(statusChanged && patch.status === "published" && !current.publishedAt ? { publishedAt: new Date() } : {}),
      },
      include,
    });
    await recordActivity(tx, {
      session, action: statusChanged ? "status_changed" : "updated", entityType: "Product", entityId: id, entityLabel: row.name,
      detail: statusChanged ? `Status -> ${patch.status}` : null, ip,
    });
    return toProductDto(row);
  }).then((dto) => {
    if (images || documents) {
      void removeUnusedProductFiles(db, previousFiles).catch(() => undefined); // files taken off the product leave the uploads folder
      void purgeOrphanProductFiles(db).catch(() => undefined); // uploads that were never saved are cleaned up after the grace period
    }
    return dto;
  });
}

export async function deleteProduct(session: AuthSession, id: string, ip: string | null) {
  authorize(session, "products", "delete");
  const db = getDb();
  const current = await db.product.findUnique({ where: { id } });
  if (!current) throw errors.notFound("Product");
  const fileIds = await filesOfProducts(db, [id]);
  await db.$transaction(async (tx) => {
    await tx.product.delete({ where: { id } });
    await recordActivity(tx, { session, action: "deleted", entityType: "Product", entityId: id, entityLabel: current.name, ip });
  });
  await removeUnusedProductFiles(db, fileIds); // its pictures and documents leave the uploads folder too
}

export const productBulkInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), ids: z.array(z.uuid()).min(1).max(200), status: publishStatus }),
  z.object({ action: z.literal("delete"), ids: z.array(z.uuid()).min(1).max(200) }),
]);

export async function bulkProducts(session: AuthSession, input: z.infer<typeof productBulkInput>, ip: string | null) {
  const db = getDb();
  if (input.action === "status") {
    authorizeBulkStatus(session, "products", input.status);
    const r = await db.$transaction(async (tx) => {
      const res = await tx.product.updateMany({
        where: { id: { in: input.ids } },
        data: { status: input.status },
      });
      if (input.status === "published") await tx.product.updateMany({ where: { id: { in: input.ids }, publishedAt: null }, data: { publishedAt: new Date() } });
      await recordActivity(tx, { session, action: "status_changed", entityType: "Product", entityLabel: `${res.count} products`, detail: `Status -> ${input.status}`, ip });
      return res;
    });
    return { count: r.count };
  }
  authorize(session, "products", "delete");
  const fileIds = await filesOfProducts(db, input.ids);
  const r = await db.$transaction(async (tx) => {
    const res = await tx.product.deleteMany({ where: { id: { in: input.ids } } });
    await recordActivity(tx, { session, action: "deleted", entityType: "Product", entityLabel: `${res.count} products`, ip });
    return res;
  });
  await removeUnusedProductFiles(db, fileIds);
  return { count: r.count };
}
