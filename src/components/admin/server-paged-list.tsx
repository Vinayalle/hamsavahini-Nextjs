"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { DataTable, type Column, type SortState } from "./data-table";
import { EmptyState, ErrorState, FilterBar, Pagination, type FilterDef } from "./page-parts";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import type { BaseEntity, PagedResult } from "@/types/common";

/**
 * A table whose search, filters, sorting and paging are done BY THE SERVER, one page per request.
 * Used for modules that grow without bound (activity log, notification history), where loading the whole table into the browser
 * would not scale. It talks to the same /api/[resource] endpoint and relies on the server for authorization.
 */
export function ServerPagedList<T extends BaseEntity>({
  path, entityLabel, columns, filters = [], searchPlaceholder, pageSize = 25, defaultSort, rowActions, emptyHint,
}: {
  path: string; entityLabel: string; columns: Column<T>[]; filters?: FilterDef[]; searchPlaceholder?: string; pageSize?: number;
  defaultSort: SortState;
  /** Receives a `reload` callback so an action can refresh the page. */
  rowActions?: (row: T, reload: () => void) => React.ReactNode;
  emptyHint?: string;
}) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>(defaultSort);
  const [state, setState] = useState<{ loading: boolean; error: string | null; data: PagedResult<T> | null }>({ loading: true, error: null, data: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => { setTerm(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const ctl = new AbortController();
    const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sortBy: sort.by, sortDir: sort.dir });
    if (term) q.set("search", term);
    for (const [k, v] of Object.entries(values)) if (v && v !== "all") q.set(k, v);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, loading: true, error: null }));
    apiFetch<PagedResult<T>>(`${path}?${q}`, { signal: ctl.signal })
      .then((data) => setState({ loading: false, error: null, data }))
      .catch((e) => {
        if (ctl.signal.aborted) return;
        setState({ loading: false, data: null, error: e instanceof ApiClientError && e.status === 403 ? "You do not have permission to view this." : e instanceof Error ? e.message : "Failed to load" });
      });
    return () => ctl.abort();
  }, [path, page, pageSize, sort, term, values, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const dirty = !!term || Object.values(values).some((v) => v && v !== "all");
  const data = state.data;

  return (
    <Card>
      <FilterBar
        search={search} onSearch={setSearch} searchPlaceholder={searchPlaceholder} filters={filters} values={values}
        onChange={(k, v) => { setValues((s) => ({ ...s, [k]: v })); setPage(1); }}
        onReset={() => { setSearch(""); setTerm(""); setValues({}); setPage(1); }}
      />
      {state.error ? (
        <ErrorState title={`Couldn't load ${entityLabel}s`} description={state.error} onRetry={reload} />
      ) : (
        <>
          <DataTable
            caption={`${entityLabel}s`} columns={columns} rows={data?.items ?? []} rowKey={(r) => r.id} sort={sort}
            onSort={(s) => { setSort(s); setPage(1); }} loading={state.loading && !data}
            rowActions={rowActions ? (row) => rowActions(row, reload) : undefined}
            empty={<EmptyState title={dirty ? `No ${entityLabel}s match` : `No ${entityLabel}s yet`} description={dirty ? "Try different search words or filters." : emptyHint ?? "Nothing has been recorded yet."} />}
          />
          {data && data.total > 0 && <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
        </>
      )}
    </Card>
  );
}
