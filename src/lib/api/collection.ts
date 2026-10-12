import type { CrudService } from "@/lib/mock/collection";
import { runQuery, type CollectionOptions } from "@/lib/mock/collection";
import type { BaseEntity, ID, ListQuery, PagedResult } from "@/types/common";
import { ApiClientError, apiFetch } from "./client";

/**
 * HTTP-backed implementation of `CrudService<T>`. The UI cannot tell it apart from the mock.
 *
 * Reads: the first subscriber triggers a paged load of the whole collection into a client cache, and the
 * existing client-side search/filter/sort/paginate runs over it. This is deliberate for the admin's data volumes
 * and keeps every page unchanged; swapping to server-side paging later only changes `useResource`.
 * Writes: always go to the server first. The cache is updated from the server's response, never optimistically,
 * so what the UI shows is what the database holds. Authorization is enforced by the server on every call.
 */
export interface ApiCollectionOptions<T extends BaseEntity> extends Pick<CollectionOptions<T>, "name" | "searchFields" | "filters" | "defaultSort" | "statusField"> {
  /** e.g. "/api/products" */
  path: string;
  archivedValue?: string;
  /** Shape the client object into the API's write payload. Throw to refuse unsupported changes. */
  toPayload?: (value: Record<string, unknown>) => Record<string, unknown>;
}

const registry = new Set<{ reset: () => void }>();
/** Lets other API-backed stores (e.g. settings) join the same sign-in/sign-out reset. */
export function registerApiCache(cache: { reset: () => void }) {
  registry.add(cache);
}
/** Forget cached data (call on sign-in / sign-out so one user's data never leaks into the next session). */
export function resetApiCaches() {
  registry.forEach((c) => c.reset());
}

const PAGE = 100;

export function createApiCollection<T extends BaseEntity>(options: ApiCollectionOptions<T>): CrudService<T> {
  const { path } = options;
  let items: readonly T[] = [];
  let ready = false;
  let error: string | null = null;
  let inflight: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const payload = (v: Record<string, unknown>) => (options.toPayload ? options.toPayload(v) : v);

  async function load(): Promise<void> {
    try {
      const all: T[] = [];
      let page = 1;
      for (;;) {
        const res = await apiFetch<PagedResult<T>>(`${path}?page=${page}&pageSize=${PAGE}`);
        all.push(...res.items);
        if (page >= res.pageCount) break;
        page += 1;
      }
      items = all;
      error = null;
    } catch (e) {
      error = e instanceof ApiClientError && e.status === 403 ? "You do not have permission to view this." : e instanceof Error ? e.message : "Failed to load";
    } finally {
      ready = true;
      inflight = null;
      emit();
    }
  }
  const ensureLoaded = () => {
    if (!ready && !inflight && typeof window !== "undefined") inflight = load();
  };
  const reload = async () => {
    ready = false;
    emit();
    inflight = load();
    await inflight;
  };
  const replace = (next: T) => {
    items = items.some((i) => i.id === next.id) ? items.map((i) => (i.id === next.id ? next : i)) : [next, ...items];
    emit();
  };

  registry.add({
    reset: () => {
      items = [];
      ready = false;
      error = null;
      inflight = null;
      emit();
    },
  });

  return {
    name: options.name,
    snapshot: () => items,
    subscribe(listener) {
      listeners.add(listener);
      ensureLoaded();
      return () => listeners.delete(listener);
    },
    ready: () => ready,
    loadError: () => error,
    reload,
    query: (source: readonly T[], q: ListQuery = {}) => runQuery(source, q, options),

    async list(q) {
      ensureLoaded();
      if (inflight) await inflight;
      return runQuery(items, q ?? {}, options);
    },
    async getById(id: ID) {
      try {
        return await apiFetch<T>(`${path}/${id}`);
      } catch (e) {
        if (e instanceof ApiClientError && e.status === 404) return null;
        throw e;
      }
    },
    async create(input) {
      const created = await apiFetch<T>(path, { method: "POST", body: payload(input as Record<string, unknown>) });
      replace(created);
      return created;
    },
    async update(id, patch) {
      const updated = await apiFetch<T>(`${path}/${id}`, { method: "PATCH", body: payload(patch as Record<string, unknown>) });
      replace(updated);
      return updated;
    },
    async archive(id) {
      const field = options.statusField as string | undefined;
      if (!field) throw new Error("This entity cannot be archived");
      const updated = await apiFetch<T>(`${path}/${id}`, { method: "PATCH", body: { [field]: options.archivedValue ?? "archived" } });
      replace(updated);
      return updated;
    },
    async remove(id) {
      await apiFetch(`${path}/${id}`, { method: "DELETE" });
      items = items.filter((i) => i.id !== id);
      emit();
    },
    async setStatus(id, status) {
      const field = (options.statusField as string | undefined) ?? "status";
      const updated = await apiFetch<T>(`${path}/${id}`, { method: "PATCH", body: { [field]: status } });
      replace(updated);
      return updated;
    },
    async bulkSetStatus(ids, status) {
      const r = await apiFetch<{ count: number }>(`${path}/bulk`, { method: "POST", body: { action: "status", ids, status } });
      await reload();
      return r.count;
    },
    async bulkRemove(ids) {
      const r = await apiFetch<{ count: number }>(`${path}/bulk`, { method: "POST", body: { action: "delete", ids } });
      await reload();
      return r.count;
    },
  };
}
