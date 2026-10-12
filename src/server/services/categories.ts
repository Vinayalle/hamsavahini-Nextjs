import "server-only";
import { z } from "zod";
import type { Category as CategoryRow } from "@/generated/prisma/client";
import { getDb } from "../db";
import { recordActivity } from "../audit";
import type { AuthSession } from "../auth";
import { errors } from "../errors";
import { patchOf } from "../resources/shared";
import { authorize, authorizeBulkStatus, authorizeStatusChange } from "../rbac";

export const publishStatus = z.enum(["draft", "published", "archived"]);
const slug = z.string().trim().min(2, "Slug is required").max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");

export const categoryInput = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  slug,
  description: z.string().trim().max(1000).default(""),
  parentId: z.uuid().nullable().default(null),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  status: publishStatus.default("draft"),
});
export const categoryPatch = patchOf(categoryInput);
export type CategoryInput = z.infer<typeof categoryInput>;

export const listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: publishStatus.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.enum(["name", "sortOrder", "status", "updatedAt", "createdAt"]).default("sortOrder"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export function toCategoryDto(c: CategoryRow) {
  return {
    id: c.id, name: c.name, slug: c.slug, description: c.description, parentId: c.parentId, sortOrder: c.sortOrder,
    status: c.status, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
  };
}

export async function listCategories(session: AuthSession, q: z.infer<typeof listQuery>) {
  authorize(session, "categories", "view");
  const where = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.search ? { OR: [{ name: { contains: q.search, mode: "insensitive" as const } }, { slug: { contains: q.search, mode: "insensitive" as const } }] } : {}),
  };
  const db = getDb();
  const [total, rows] = await Promise.all([
    db.category.count({ where }),
    db.category.findMany({ where, orderBy: { [q.sortBy]: q.sortDir }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  return { items: rows.map(toCategoryDto), total, page: q.page, pageSize: q.pageSize, pageCount: Math.max(1, Math.ceil(total / q.pageSize)) };
}

export async function getCategory(session: AuthSession, id: string) {
  authorize(session, "categories", "view");
  const row = await getDb().category.findUnique({ where: { id } });
  if (!row) throw errors.notFound("Category");
  return toCategoryDto(row);
}

/** True when `ancestorId` is `id` itself or one of its ancestors. Prevents A → B → A parent cycles. */
async function wouldCycle(categoryId: string, newParentId: string): Promise<boolean> {
  const db = getDb();
  let cursor: string | null = newParentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === categoryId) return true;
    if (seen.has(cursor)) return true; // corrupted data guard
    seen.add(cursor);
    const parent: { parentId: string | null } | null = await db.category.findUnique({ where: { id: cursor }, select: { parentId: true } });
    cursor = parent?.parentId ?? null;
  }
  return false;
}

export async function createCategory(session: AuthSession, input: CategoryInput, ip: string | null) {
  authorize(session, "categories", "create");
  authorizeStatusChange(session, "categories", null, input.status);
  const db = getDb();
  if (input.parentId && !(await db.category.findUnique({ where: { id: input.parentId } }))) throw errors.invalid("Parent category does not exist", { parentId: "Parent category does not exist" });
  if (await db.category.findUnique({ where: { slug: input.slug } })) throw errors.conflict("Another category uses this slug", { slug: "Another category uses this slug" });
  return db.$transaction(async (tx) => {
    const row = await tx.category.create({ data: input });
    await recordActivity(tx, { session, action: "created", entityType: "Category", entityId: row.id, entityLabel: row.name, ip });
    return toCategoryDto(row);
  });
}

export async function updateCategory(session: AuthSession, id: string, patch: Partial<CategoryInput>, ip: string | null) {
  authorize(session, "categories", "edit");
  const db = getDb();
  const current = await db.category.findUnique({ where: { id } });
  if (!current) throw errors.notFound("Category");
  if (patch.status) authorizeStatusChange(session, "categories", current.status, patch.status);
  if (patch.slug && patch.slug !== current.slug && (await db.category.findUnique({ where: { slug: patch.slug } }))) throw errors.conflict("Another category uses this slug", { slug: "Another category uses this slug" });
  if (patch.parentId) {
    if (!(await db.category.findUnique({ where: { id: patch.parentId } }))) throw errors.invalid("Parent category does not exist", { parentId: "Parent category does not exist" });
    if (await wouldCycle(id, patch.parentId)) throw errors.invalid("A category cannot be placed under itself or its own sub-category", { parentId: "A category cannot be placed under itself or its own sub-category" });
  }
  return db.$transaction(async (tx) => {
    const row = await tx.category.update({ where: { id }, data: patch });
    await recordActivity(tx, {
      session, action: patch.status && patch.status !== current.status ? "status_changed" : "updated", entityType: "Category", entityId: id, entityLabel: row.name,
      detail: patch.status && patch.status !== current.status ? `Status -> ${patch.status}` : null, ip,
    });
    return toCategoryDto(row);
  });
}

async function assertDeletable(id: string) {
  const db = getDb();
  const [products, children] = await Promise.all([db.product.count({ where: { categoryId: id } }), db.category.count({ where: { parentId: id } })]);
  if (products > 0) throw errors.conflict(`${products} product${products > 1 ? "s" : ""} still use this category. Reassign them first or archive the category.`);
  if (children > 0) throw errors.conflict("It has child categories.");
}

export async function deleteCategory(session: AuthSession, id: string, ip: string | null) {
  authorize(session, "categories", "delete");
  const db = getDb();
  const current = await db.category.findUnique({ where: { id } });
  if (!current) throw errors.notFound("Category");
  await assertDeletable(id);
  await db.$transaction(async (tx) => {
    await tx.category.delete({ where: { id } });
    await recordActivity(tx, { session, action: "deleted", entityType: "Category", entityId: id, entityLabel: current.name, ip });
  });
}

export const bulkInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), ids: z.array(z.uuid()).min(1).max(200), status: publishStatus }),
  z.object({ action: z.literal("delete"), ids: z.array(z.uuid()).min(1).max(200) }),
]);

export async function bulkCategories(session: AuthSession, input: z.infer<typeof bulkInput>, ip: string | null) {
  const db = getDb();
  if (input.action === "status") {
    authorizeBulkStatus(session, "categories", input.status);
    const result = await db.$transaction(async (tx) => {
      const r = await tx.category.updateMany({ where: { id: { in: input.ids } }, data: { status: input.status } });
      await recordActivity(tx, { session, action: "status_changed", entityType: "Category", entityLabel: `${r.count} categories`, detail: `Status -> ${input.status}`, ip });
      return r;
    });
    return { count: result.count };
  }
  authorize(session, "categories", "delete");
  for (const id of input.ids) await assertDeletable(id);
  const result = await db.$transaction(async (tx) => {
    const r = await tx.category.deleteMany({ where: { id: { in: input.ids } } });
    await recordActivity(tx, { session, action: "deleted", entityType: "Category", entityLabel: `${r.count} categories`, ip });
    return r;
  });
  return { count: result.count };
}
