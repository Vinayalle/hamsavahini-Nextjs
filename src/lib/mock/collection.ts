import type { BaseEntity, ID, ListQuery, PagedResult } from "@/types/common";
import { uid } from "@/lib/utils";

/**
 * In-memory collection that mimics a REST resource.
 *
 * This is the ONLY place that knows data lives in browser memory. UI code talks to the
 * `CrudService` interface, so swapping in real API services later means implementing
 * the same interface with `fetch` calls. Nothing here is persisted: a full page reload
 * resets every collection to its seed data.
 */
export interface CrudService<T extends BaseEntity> {
  readonly name: string;
  list(query?: ListQuery): Promise<PagedResult<T>>;
  getById(id: ID): Promise<T | null>;
  create(input: Omit<T, keyof BaseEntity>): Promise<T>;
  update(id: ID, patch: Partial<Omit<T, keyof BaseEntity>>): Promise<T>;
  archive(id: ID): Promise<T>;
  remove(id: ID): Promise<void>;
  setStatus(id: ID, status: string): Promise<T>;
  bulkSetStatus(ids: ID[], status: string): Promise<number>;
  bulkRemove(ids: ID[]): Promise<number>;
  /** Synchronous helpers used by the React binding (`useResource`). */
  snapshot(): readonly T[];
  subscribe(listener: () => void): () => void;
  query(items: readonly T[], query?: ListQuery): PagedResult<T>;
  /** Remote-backed services only: false until the first load completes. Mock services are always ready. */
  ready?(): boolean;
  /** Remote-backed services only: message of the last failed load, or null. */
  loadError?(): string | null;
  reload?(): Promise<void>;
}

export interface CollectionOptions<T> {
  name: string;
  entityType: string;
  labelOf: (item: T) => string;
  searchFields: (keyof T)[];
  /** Custom per-filter predicates. Unlisted filter keys fall back to strict equality on the field. */
  filters?: Record<string, (item: T, value: string) => boolean>;
  statusField?: keyof T;
  archivedValue?: string;
  defaultSort?: { by: string; dir: "asc" | "desc" };
  /** Skip activity logging (used for the activity log itself). */
  silent?: boolean;
}

type ActivityRecorder = (entry: {
  action: "created" | "updated" | "deleted" | "archived" | "status_changed";
  entityType: string;
  entityLabel: string;
  detail?: string;
}) => void;

let recorder: ActivityRecorder | null = null;
export function registerActivityRecorder(fn: ActivityRecorder) {
  recorder = fn;
}

const latency = () => Promise.resolve();

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/** Search / filter / sort / paginate over an in-memory array. Shared by the mock and API-backed services. */
export function runQuery<T extends BaseEntity>(source: readonly T[], q: ListQuery, options: Pick<CollectionOptions<T>, "searchFields" | "filters" | "defaultSort">): PagedResult<T> {
  const pageSize = q.pageSize ?? 10;
  let rows = source.slice();

  const term = q.search?.trim().toLowerCase();
  if (term) {
    rows = rows.filter((r) =>
      options.searchFields.some((f) => {
        const v = r[f];
        return Array.isArray(v)
          ? v.join(" ").toLowerCase().includes(term)
          : String(v ?? "").toLowerCase().includes(term);
      }),
    );
  }

  for (const [key, value] of Object.entries(q.filters ?? {})) {
    if (!value || value === "all") continue;
    const custom = options.filters?.[key];
    rows = rows.filter((r) =>
      custom ? custom(r, value) : String((r as Record<string, unknown>)[key]) === value,
    );
  }

  const sortBy = q.sortBy ?? options.defaultSort?.by ?? "updatedAt";
  const dir = q.sortDir ?? options.defaultSort?.dir ?? "desc";
  rows.sort((a, b) => {
    const c = compare((a as Record<string, unknown>)[sortBy], (b as Record<string, unknown>)[sortBy]);
    return dir === "asc" ? c : -c;
  });

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, q.page ?? 1), pageCount);
  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
    pageCount,
  };
}

export function createCollection<T extends BaseEntity>(
  seed: T[],
  options: CollectionOptions<T>,
): CrudService<T> {
  let items: readonly T[] = seed;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const set = (next: readonly T[]) => {
    items = next;
    emit();
  };
  const log = (
    action: Parameters<ActivityRecorder>[0]["action"],
    item: T,
    detail?: string,
  ) => {
    if (!options.silent) {
      recorder?.({ action, entityType: options.entityType, entityLabel: options.labelOf(item), detail });
    }
  };
  const statusField = options.statusField;

  const query = (source: readonly T[], q: ListQuery = {}) => runQuery(source, q, options);

  const mustFind = (id: ID) => {
    const found = items.find((i) => i.id === id);
    if (!found) throw new Error(`${options.entityType} not found`);
    return found;
  };

  return {
    name: options.name,
    snapshot: () => items,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    query,
    async list(q) {
      await latency();
      return query(items, q);
    },
    async getById(id) {
      await latency();
      return items.find((i) => i.id === id) ?? null;
    },
    async create(input) {
      await latency();
      const now = new Date().toISOString();
      const created = { ...input, id: uid(options.name.slice(0, 3)), createdAt: now, updatedAt: now } as T;
      set([created, ...items]);
      log("created", created);
      return created;
    },
    async update(id, patch) {
      await latency();
      const current = mustFind(id);
      const next = { ...current, ...patch, updatedAt: new Date().toISOString() } as T;
      set(items.map((i) => (i.id === id ? next : i)));
      log("updated", next);
      return next;
    },
    async archive(id) {
      await latency();
      const current = mustFind(id);
      const archived = options.archivedValue ?? "archived";
      const patch = (statusField ? { [statusField]: archived } : { active: false }) as Partial<T>;
      const next = { ...current, ...patch, updatedAt: new Date().toISOString() } as T;
      set(items.map((i) => (i.id === id ? next : i)));
      log("archived", next);
      return next;
    },
    async remove(id) {
      await latency();
      const current = mustFind(id);
      set(items.filter((i) => i.id !== id));
      log("deleted", current);
    },
    async setStatus(id, status) {
      await latency();
      if (!statusField) throw new Error("This entity has no status field");
      const current = mustFind(id);
      const next = { ...current, [statusField]: status, updatedAt: new Date().toISOString() } as T;
      set(items.map((i) => (i.id === id ? next : i)));
      log("status_changed", next, `Status → ${status}`);
      return next;
    },
    async bulkSetStatus(ids, status) {
      await latency();
      if (!statusField) throw new Error("This entity has no status field");
      const idSet = new Set(ids);
      const now = new Date().toISOString();
      let count = 0;
      set(
        items.map((i) => {
          if (!idSet.has(i.id)) return i;
          count++;
          return { ...i, [statusField]: status, updatedAt: now } as T;
        }),
      );
      if (count && recorder && !options.silent) {
        recorder({
          action: "status_changed",
          entityType: options.entityType,
          entityLabel: `${count} ${options.entityType.toLowerCase()} records`,
          detail: `Status → ${status}`,
        });
      }
      return count;
    },
    async bulkRemove(ids) {
      await latency();
      const idSet = new Set(ids);
      const before = items.length;
      set(items.filter((i) => !idSet.has(i.id)));
      const count = before - items.length;
      if (count && recorder && !options.silent) {
        recorder({
          action: "deleted",
          entityType: options.entityType,
          entityLabel: `${count} ${options.entityType.toLowerCase()} records`,
        });
      }
      return count;
    },
  };
}
