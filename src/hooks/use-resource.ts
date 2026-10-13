"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { CrudService } from "@/lib/mock/collection";
import type { BaseEntity, ListQuery, PagedResult } from "@/types/common";
import { settingsService } from "@/lib/services/settings";
import { apiFetch, isApiMode } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { activityService } from "@/lib/services";
import type { ActivityLog } from "@/types/entities";

/** All records of a collection, re-rendering on any mutation. */
export function useAll<T extends BaseEntity>(service: CrudService<T>): readonly T[] {
  return useSyncExternalStore(service.subscribe, service.snapshot, service.snapshot);
}

/** Query a collection (search/filter/sort/paginate). Swap for a fetch-based hook when the API exists. */
export function useResource<T extends BaseEntity>(
  service: CrudService<T>,
  query: ListQuery,
): PagedResult<T> & { all: readonly T[] } {
  const all = useAll(service);
  const key = JSON.stringify(query);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const result = useMemo(() => service.query(all, query), [service, all, key]);
  return { ...result, all };
}

/**
 * True once every given remote-backed service has finished its first load (mock services are always ready). Pages use it to show a
 * skeleton while data is on its way instead of an "empty" message.
 */
export function useServiceReady(...services: CrudService<BaseEntity>[]): boolean {
  const subscribe = (l: () => void) => {
    const offs = services.map((s) => s.subscribe(l));
    return () => offs.forEach((off) => off());
  };
  return useSyncExternalStore(subscribe, () => services.every((s) => s.ready?.() ?? true), () => true);
}

/** False until the website settings have been read from the server (api mode), so forms never show the built-in placeholder values. */
export function useSettingsReady(): boolean {
  return useSyncExternalStore(settingsService.subscribe, settingsService.ready, () => true);
}

export function useRecord<T extends BaseEntity>(service: CrudService<T>, id: string): T | undefined {
  const all = useAll(service);
  return all.find((i) => i.id === id);
}

export function useSettings() {
  return useSyncExternalStore(settingsService.subscribe, settingsService.snapshot, settingsService.snapshot);
}

const NO_SUBSCRIBE = () => () => undefined;
const NONE: readonly ActivityLog[] = [];
/**
 * Recent audit entries about one record. Mock mode filters the in-memory log; api mode asks the server for matching entries
 * (only when the employee may view the activity log) instead of downloading the whole audit trail.
 */
export function useEntityHistory(entityType: string, label: string | undefined, limit = 6): readonly ActivityLog[] {
  const { can } = useAuth();
  const mock = useSyncExternalStore(isApiMode ? NO_SUBSCRIBE : activityService.subscribe, isApiMode ? () => NONE : activityService.snapshot, () => NONE);
  const [remote, setRemote] = useState<readonly ActivityLog[]>(NONE);
  const allowed = isApiMode && can("activity_logs", "view");
  useEffect(() => {
    if (!allowed || !label) return;
    let alive = true;
    apiFetch<{ items: ActivityLog[] }>(`/api/activity-logs?search=${encodeURIComponent(label)}&pageSize=50&sortBy=createdAt&sortDir=desc`)
      .then((r) => alive && setRemote(r.items))
      .catch(() => alive && setRemote(NONE));
    return () => { alive = false; };
  }, [allowed, label]);
  return useMemo(() => (isApiMode ? remote : mock).filter((a) => a.entityType === entityType && a.entityLabel === label).slice(0, limit), [mock, remote, entityType, label, limit]);
}
