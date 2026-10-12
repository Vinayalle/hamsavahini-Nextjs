import "server-only";
import { z, type ZodType } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "../db";
import { recordActivity } from "../audit";
import type { AuthSession } from "../auth";
import { ApiError, errors } from "../errors";
import { authorize, authorizeBulkStatus, authorizeRecord, assignedFilter, authorizeStatusChange, can, scopeOf } from "../rbac";

/* ═══════════════════════════════════════════════════════════════════════════════════════════════
 * GENERIC, PERMISSION-ENFORCING CRUD FOR CMS MODULES
 *
 * Every module declares its fields once (a ResourceConfig). This file supplies the behaviour, so the security
 * rules cannot differ from module to module:
 *   - authorize BEFORE reading the body or touching data;
 *   - one catalogue permission per action (view/create/edit/delete, plus publish/unpublish/archive/restore for
 *     visibility changes and change_status/assign for workflow fields);
 *   - record-level scope ("assigned only") applied to lists, single records, updates and bulk operations;
 *   - friendly uniqueness errors; delete guards that mirror the database's foreign keys;
 *   - audit entry written in the SAME transaction as the change.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════ */

export interface Ctx {
  session: AuthSession;
  ip: string | null;
}

/** The slice of a Prisma model delegate this framework uses. */
interface Delegate {
  count(args?: unknown): Promise<number>;
  findMany(args?: unknown): Promise<unknown[]>;
  findFirst(args?: unknown): Promise<unknown | null>;
  findUnique(args: unknown): Promise<unknown | null>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  delete(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
  deleteMany(args: unknown): Promise<{ count: number }>;
}
type Db = ReturnType<typeof getDb> | Prisma.TransactionClient;
const delegate = (db: Db, model: string) => (db as unknown as Record<string, Delegate>)[model];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export interface ResourceConfig {
  /** URL segment: /api/<key> */
  key: string;
  /** Catalogue resource that guards it (src/lib/authz/catalog.ts). */
  permission: string;
  entity: string;
  /** Prisma delegate name, e.g. "post". */
  model: string;
  include?: object;
  toDto: (row: Row) => unknown;
  label: (row: Row) => string;

  search: string[];
  sorts: string[];
  defaultSort: { by: string; dir: "asc" | "desc" };
  /** query-string filter -> Prisma `where` fragment (return undefined to ignore the value) */
  filters?: Record<string, (value: string) => object | undefined>;

  createSchema?: ZodType;
  patchSchema?: ZodType;
  buildCreate?: (input: Row, ctx: Ctx) => object | Promise<object>;
  buildUpdate?: (patch: Row, current: Row, ctx: Ctx) => object | Promise<object>;

  /** Status field and how its transitions are authorised. */
  status?: {
    field: string;
    /** "publish": published/archived/restore rights. "workflow": a single `change_status` right. */
    mode: "publish" | "workflow";
    values: readonly string[];
    /** Optional column stamped when first published. */
    publishedAtField?: string;
  };
  /** A boolean visibility switch (e.g. Location.active): turning it on needs `publish`, off needs `unpublish`. */
  visibility?: { field: string };
  /** Baseline right for any change. Defaults to "edit"; resources without an `edit` action name theirs. */
  editAction?: string;
  /** Patch keys that need a specific action instead of plain `edit`. */
  fieldActions?: Record<string, string>;

  /** Uniqueness pre-checks, so the user gets a field error instead of a database error. */
  unique?: { fields: string[]; message: string; errorField: string; ignoreCase?: boolean }[];
  /** Converts request-shaped values (e.g. "2026-10-01") into database-shaped ones before the uniqueness lookup. */
  uniqueValues?: (values: Row) => Row;
  guardDelete?: (row: Row, db: Db) => Promise<void>;
  /** Runs after the row is deleted and committed (e.g. remove the stored file). Failures are logged, never shown to the client. */
  afterDelete?: (row: Row, db: Db) => Promise<void>;
  /** Record-level restriction by assignee (rfqs, enquiries). */
  scope?: "assignee";
  readOnly?: boolean;
  noDelete?: boolean;
}

/* ───────────────────────── queries ───────────────────────── */

export const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.string().max(40).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

function scopeWhere(cfg: ResourceConfig, session: AuthSession, action: string): object | undefined {
  if (cfg.scope !== "assignee") {
    authorize(session, cfg.permission, action);
    return undefined;
  }
  return assignedFilter(session, cfg.permission, action);
}

export async function listResource(cfg: ResourceConfig, session: AuthSession, q: z.infer<typeof listQuerySchema> & { [filter: string]: unknown }) {
  const scope = scopeWhere(cfg, session, "view");
  const and: object[] = [];
  if (scope) and.push(scope);
  if (q.search) and.push({ OR: cfg.search.map((f) => ({ [f]: { contains: q.search, mode: "insensitive" } })) });
  for (const [param, build] of Object.entries(cfg.filters ?? {})) {
    const value = typeof q[param] === "string" ? (q[param] as string) : undefined;
    if (value && value !== "all") {
      const frag = build(value);
      if (frag) and.push(frag);
    }
  }
  const where = and.length ? { AND: and } : {};
  const sortBy = q.sortBy && cfg.sorts.includes(q.sortBy) ? q.sortBy : cfg.defaultSort.by;
  const sortDir = q.sortDir ?? cfg.defaultSort.dir;
  const db = getDb();
  const d = delegate(db, cfg.model);
  const [total, rows] = await Promise.all([
    d.count({ where }),
    d.findMany({ where, include: cfg.include, orderBy: { [sortBy]: sortDir }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  return { items: rows.map(cfg.toDto), total, page: q.page, pageSize: q.pageSize, pageCount: Math.max(1, Math.ceil(total / q.pageSize)) };
}

async function loadRow(cfg: ResourceConfig, db: Db, id: string): Promise<Row> {
  const row = await delegate(db, cfg.model).findUnique({ where: { id }, include: cfg.include });
  if (!row) throw errors.notFound(cfg.entity);
  return row;
}

/** Single-record access check honouring record-level scope (out-of-scope looks like "not found"). */
function authorizeOn(cfg: ResourceConfig, session: AuthSession, action: string, row: Row) {
  if (cfg.scope === "assignee") authorizeRecord(session, cfg.permission, action, { assignedToId: row.assignedToId ?? null });
  else authorize(session, cfg.permission, action);
}

export async function getResource(cfg: ResourceConfig, session: AuthSession, id: string) {
  authorize(session, cfg.permission, "view"); // before the lookup, so unauthorised callers learn nothing
  const row = await loadRow(cfg, getDb(), id);
  authorizeOn(cfg, session, "view", row);
  return cfg.toDto(row);
}

/* ───────────────────────── uniqueness ───────────────────────── */

async function checkUnique(cfg: ResourceConfig, db: Db, rawValues: Row, selfId?: string) {
  const values = cfg.uniqueValues ? cfg.uniqueValues(rawValues) : rawValues;
  for (const rule of cfg.unique ?? []) {
    if (rule.fields.some((f) => values[f] === undefined)) continue; // field not part of this write
    const where: Row = { AND: rule.fields.map((f) => (rule.ignoreCase && typeof values[f] === "string" ? { [f]: { equals: values[f], mode: "insensitive" } } : { [f]: values[f] })) };
    if (selfId) where.NOT = { id: selfId };
    if (await delegate(db, cfg.model).findFirst({ where, select: { id: true } })) throw errors.conflict(rule.message, { [rule.errorField]: rule.message });
  }
}

/* ───────────────────────── mutations ───────────────────────── */

export async function createResource(cfg: ResourceConfig, ctx: Ctx, input: Row) {
  const { session } = ctx;
  authorize(session, cfg.permission, "view");
  if (cfg.readOnly || !cfg.createSchema || !cfg.buildCreate) throw new ApiError(405, "method_not_allowed", `${cfg.entity} records cannot be created here`);
  authorize(session, cfg.permission, "create");
  if (cfg.status && input[cfg.status.field] !== undefined && cfg.status.mode === "publish") authorizeStatusChange(session, cfg.permission, null, input[cfg.status.field]);
  if (cfg.visibility && input[cfg.visibility.field] === true) authorize(session, cfg.permission, "publish");
  const db = getDb();
  await checkUnique(cfg, db, input);
  const data = await cfg.buildCreate(input, ctx);
  return db.$transaction(async (tx) => {
    const row = (await delegate(tx, cfg.model).create({ data, include: cfg.include })) as Row;
    await recordActivity(tx, { session, action: "created", entityType: cfg.entity, entityId: row.id, entityLabel: cfg.label(row), ip: ctx.ip });
    return cfg.toDto(row);
  });
}

export async function updateResource(cfg: ResourceConfig, ctx: Ctx, id: string, patch: Row) {
  const { session } = ctx;
  authorize(session, cfg.permission, "view");
  if (cfg.readOnly || !cfg.buildUpdate) throw new ApiError(405, "method_not_allowed", `${cfg.entity} records cannot be edited here`);
  const edit = cfg.editAction ?? "edit";
  authorize(session, cfg.permission, edit); // baseline right; field-specific rights are added below
  const db = getDb();
  const current = await loadRow(cfg, db, id);
  authorizeOn(cfg, session, edit, current);

  // Field-specific rights.
  const keys = Object.keys(patch);
  for (const key of keys) {
    const need = cfg.fieldActions?.[key];
    if (need) authorize(session, cfg.permission, need);
  }
  let statusChanged = false;
  if (cfg.status && patch[cfg.status.field] !== undefined && patch[cfg.status.field] !== current[cfg.status.field]) {
    statusChanged = true;
    if (cfg.status.mode === "publish") authorizeStatusChange(session, cfg.permission, current[cfg.status.field], patch[cfg.status.field]);
    else authorize(session, cfg.permission, "change_status");
  }
  if (cfg.visibility && patch[cfg.visibility.field] !== undefined && patch[cfg.visibility.field] !== current[cfg.visibility.field]) {
    authorize(session, cfg.permission, patch[cfg.visibility.field] ? "publish" : "unpublish");
  }
  await checkUnique(cfg, db, { ...current, ...patch }, id);
  const data = await cfg.buildUpdate(patch, current, ctx);
  return db.$transaction(async (tx) => {
    const row = (await delegate(tx, cfg.model).update({ where: { id }, data, include: cfg.include })) as Row;
    await recordActivity(tx, {
      session, action: statusChanged ? "status_changed" : "updated", entityType: cfg.entity, entityId: id, entityLabel: cfg.label(row),
      detail: statusChanged ? `Status -> ${patch[cfg.status!.field]}` : `Fields: ${keys.filter((k) => k !== "notes").join(", ") || "notes"}`, ip: ctx.ip,
    });
    return cfg.toDto(row);
  });
}

export async function deleteResource(cfg: ResourceConfig, ctx: Ctx, id: string) {
  const { session } = ctx;
  authorize(session, cfg.permission, "view");
  if (cfg.readOnly || cfg.noDelete) throw new ApiError(405, "method_not_allowed", `${cfg.entity} records cannot be deleted`);
  authorize(session, cfg.permission, "delete");
  const db = getDb();
  const row = await loadRow(cfg, db, id);
  authorizeOn(cfg, session, "delete", row);
  await cfg.guardDelete?.(row, db);
  await db.$transaction(async (tx) => {
    await delegate(tx, cfg.model).delete({ where: { id } });
    await recordActivity(tx, { session, action: "deleted", entityType: cfg.entity, entityId: id, entityLabel: cfg.label(row), ip: ctx.ip });
  });
  await cfg.afterDelete?.(row, db).catch((e) => console.error(`[api] cleanup after deleting ${cfg.entity} failed`, e instanceof Error ? e.message : "unknown"));
}

export const bulkSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), ids: z.array(z.uuid()).min(1).max(200), status: z.string().max(40) }),
  z.object({ action: z.literal("delete"), ids: z.array(z.uuid()).min(1).max(200) }),
]);

export async function bulkResource(cfg: ResourceConfig, ctx: Ctx, input: z.infer<typeof bulkSchema>) {
  const { session } = ctx;
  authorize(session, cfg.permission, "view");
  if (cfg.readOnly) throw new ApiError(405, "method_not_allowed", "Not supported");
  const db = getDb();
  // Bulk operations only ever touch records the user may see (record-level scope).
  const scope = cfg.scope === "assignee" && scopeOf(session, cfg.permission, "view") === "assigned" ? { assignedToId: session.user.id } : {};
  const where = { id: { in: input.ids }, ...scope };
  if (input.action === "status") {
    if (!cfg.status) throw errors.invalid("This module has no status", { status: "This module has no status" });
    if (!cfg.status.values.includes(input.status)) throw errors.invalid("Unknown status", { status: "Unknown status" });
    if (cfg.status.mode === "publish") authorizeBulkStatus(session, cfg.permission, input.status);
    else { authorize(session, cfg.permission, cfg.editAction ?? "edit"); authorize(session, cfg.permission, "change_status"); }
    const res = await db.$transaction(async (tx) => {
      const r = await delegate(tx, cfg.model).updateMany({ where, data: { [cfg.status!.field]: input.status } });
      if (cfg.status!.publishedAtField && input.status === "published") await delegate(tx, cfg.model).updateMany({ where: { ...where, [cfg.status!.publishedAtField]: null }, data: { [cfg.status!.publishedAtField]: new Date() } });
      await recordActivity(tx, { session, action: "status_changed", entityType: cfg.entity, entityLabel: `${r.count} records`, detail: `Status -> ${input.status}`, ip: ctx.ip });
      return r;
    });
    return { count: res.count };
  }
  if (cfg.noDelete) throw new ApiError(405, "method_not_allowed", "Not supported");
  authorize(session, cfg.permission, "delete");
  const doomed: Row[] = [];
  for (const id of input.ids) {
    const row = await delegate(db, cfg.model).findUnique({ where: { id }, include: cfg.include });
    if (!row) continue;
    authorizeOn(cfg, session, "delete", row);
    await cfg.guardDelete?.(row, db); // all-or-nothing: any guard failure aborts before anything is deleted
    doomed.push(row);
  }
  const res = await db.$transaction(async (tx) => {
    const r = await delegate(tx, cfg.model).deleteMany({ where });
    await recordActivity(tx, { session, action: "deleted", entityType: cfg.entity, entityLabel: `${r.count} records`, ip: ctx.ip });
    return r;
  });
  for (const row of doomed) await cfg.afterDelete?.(row, db).catch((e) => console.error(`[api] cleanup after deleting ${cfg.entity} failed`, e instanceof Error ? e.message : "unknown"));
  return { count: res.count };
}

export { can };
