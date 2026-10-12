"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { Archive, Eye, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CrudService } from "@/lib/mock/collection";
import type { BaseEntity } from "@/types/common";
import { useResource } from "@/hooks/use-resource";
import { DataTable, RowActions, type Column, type RowActionItem, type SortState } from "./data-table";
import { EmptyState, ErrorState, FilterBar, Pagination, type FilterDef } from "./page-parts";
import { statusLabel } from "./status-badge";
import { useConfirm } from "./dialogs";

export interface StatusOption {
  value: string;
  label?: string;
}

export interface ResourceListProps<T extends BaseEntity> {
  service: CrudService<T>;
  entityLabel: string; // singular, e.g. "product"
  columns: Column<T>[];
  filters?: FilterDef[];
  searchPlaceholder?: string;
  defaultSort?: SortState;
  pageSize?: number;
  /** Detail / edit links. Return undefined to hide. */
  viewHref?: (row: T) => string | undefined;
  editHref?: (row: T) => string | undefined;
  /** Allowed status transitions shown in row + bulk menus. */
  statuses?: StatusOption[];
  currentStatus?: (row: T) => string;
  /** Enable the Archive action (sets the service's archived value). */
  archivable?: boolean;
  deletable?: boolean;
  selectable?: boolean;
  nameOf: (row: T) => string;
  extraRowActions?: (row: T) => RowActionItem[];
  toolbarExtra?: React.ReactNode;
  emptyAction?: React.ReactNode;
  /** Extra constant filters merged into every query (e.g. a pre-filtered view). */
  baseFilters?: Record<string, string>;
  /** Return a reason string to block deleting a row (e.g. it is still referenced). */
  deleteGuard?: (row: T) => string | null;
}

export function ResourceList<T extends BaseEntity>({
  service, entityLabel, columns, filters = [], searchPlaceholder, defaultSort, pageSize = 10, viewHref, editHref,
  statuses, currentStatus, archivable, deletable = true, selectable, nameOf, extraRowActions, toolbarExtra, emptyAction,
  baseFilters, deleteGuard,
}: ResourceListProps<T>) {
  const confirm = useConfirm();
  // Remote-backed services report load state; the in-memory mock is always ready.
  const ready = useSyncExternalStore(service.subscribe, () => service.ready?.() ?? true, () => true);
  const loadError = useSyncExternalStore(service.subscribe, () => service.loadError?.() ?? null, () => null);
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(filters.flatMap((f) => (params.get(f.key) ? [[f.key, params.get(f.key)!]] : []))),
  );
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | undefined>(defaultSort);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const data = useResource(service, {
    search, page, pageSize, sortBy: sort?.by, sortDir: sort?.dir, filters: { ...baseFilters, ...filterValues },
  });

  // Keep the page valid and drop selections for rows that no longer exist.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (page !== data.page) setPage(data.page);
  }, [page, data.page]);
  useEffect(() => {
    const ids = new Set(data.all.map((r) => r.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected((s) => (Array.from(s).every((id) => ids.has(id)) ? s : new Set(Array.from(s).filter((id) => ids.has(id)))));
  }, [data.all]);

  const reset = () => {
    setSearch("");
    setFilterValues({});
    setPage(1);
  };

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast.success(success);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  const changeStatus = async (row: T, value: string) => {
    const ok = await confirm({
      title: `Change status to ${statusLabel(value)}?`,
      description: `“${nameOf(row)}” will be marked as ${statusLabel(value).toLowerCase()}.`,
      confirmLabel: "Change status",
    });
    if (ok) await run(() => service.setStatus(row.id, value), `Status updated to ${statusLabel(value)}`);
  };

  const archive = async (row: T) => {
    const ok = await confirm({
      title: `Archive ${entityLabel}?`,
      description: `“${nameOf(row)}” will be archived and hidden from the website. You can restore it later by changing its status.`,
      confirmLabel: "Archive",
    });
    if (ok) await run(() => service.archive(row.id), `${nameOf(row)} archived`);
  };

  const remove = async (row: T) => {
    const blocked = deleteGuard?.(row);
    if (blocked) {
      toast.error(`Cannot delete ${nameOf(row)}`, { description: blocked });
      return;
    }
    const ok = await confirm({
      title: `Delete ${entityLabel}?`,
      description: `“${nameOf(row)}” will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) await run(() => service.remove(row.id), `${nameOf(row)} deleted`);
  };

  const bulkStatus = async (value: string) => {
    const ids = Array.from(selected);
    const ok = await confirm({
      title: `Mark ${ids.length} ${entityLabel}${ids.length > 1 ? "s" : ""} as ${statusLabel(value)}?`,
      confirmLabel: "Apply",
    });
    if (!ok) return;
    await run(() => service.bulkSetStatus(ids, value), `${ids.length} updated to ${statusLabel(value)}`);
    setSelected(new Set());
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    const blockedRow = data.all.find((r) => ids.includes(r.id) && deleteGuard?.(r));
    if (blockedRow) {
      toast.error(`Cannot delete ${nameOf(blockedRow)}`, { description: deleteGuard?.(blockedRow) ?? undefined });
      return;
    }
    const ok = await confirm({
      title: `Delete ${ids.length} ${entityLabel}${ids.length > 1 ? "s" : ""}?`,
      description: "The selected records will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    await run(() => service.bulkRemove(ids), `${ids.length} deleted`);
    setSelected(new Set());
  };

  const rowActions = (row: T) => {
    const cur = currentStatus?.(row);
    const items: RowActionItem[] = [
      { label: "View details", icon: Eye, href: viewHref?.(row), hidden: !viewHref?.(row) },
      { label: "Edit", icon: Pencil, href: editHref?.(row), hidden: !editHref?.(row) },
      ...(extraRowActions?.(row) ?? []),
      ...(statuses ?? [])
        .filter((s) => s.value !== cur)
        .map<RowActionItem>((s) => ({
          label: `Mark as ${s.label ?? statusLabel(s.value)}`,
          onSelect: () => void changeStatus(row, s.value),
          separatorBefore: false,
        })),
      { label: "Archive", icon: Archive as LucideIcon, onSelect: () => void archive(row), hidden: !archivable || cur === "archived", separatorBefore: true },
      { label: "Delete", icon: Trash2, destructive: true, onSelect: () => void remove(row), hidden: !deletable, separatorBefore: true },
    ];
    return <RowActions items={items} label={`Actions for ${nameOf(row)}`} />;
  };

  const hasActions = !!(deletable || archivable || statuses?.length || viewHref || editHref || extraRowActions);
  const filtering = !!search || Object.values(filterValues).some((v) => v && v !== "all");

  return (
    <Card className="overflow-hidden">
      <FilterBar
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={searchPlaceholder ?? `Search ${entityLabel}s…`}
        filters={filters}
        values={filterValues}
        onChange={(k, v) => { setFilterValues((f) => ({ ...f, [k]: v })); setPage(1); }}
        onReset={reset}
        extra={toolbarExtra}
      />

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-brand-50 px-4 py-2.5 text-sm" role="region" aria-label="Bulk actions">
          <span className="font-medium text-brand-700">{selected.size} selected</span>
          <span className="mx-1 h-4 w-px bg-brand-200" aria-hidden />
          {(statuses ?? []).map((s) => (
            <Button key={s.value} size="sm" variant="secondary" onClick={() => void bulkStatus(s.value)}>
              Mark {s.label ?? statusLabel(s.value)}
            </Button>
          ))}
          {deletable && (
            <Button size="sm" variant="danger" onClick={() => void bulkDelete()}><Trash2 className="size-3.5" /> Delete</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {loadError && ready ? (
        <ErrorState title={`Couldn't load ${entityLabel}s`} description={loadError} onRetry={() => void service.reload?.()} />
      ) : (
      <DataTable
        caption={`${entityLabel} list`}
        loading={!ready}
        columns={columns}
        rows={data.items}
        rowKey={(r) => r.id}
        sort={sort}
        onSort={(s) => { setSort(s); setPage(1); }}
        selectable={selectable}
        selected={selected}
        onSelectedChange={setSelected}
        rowActions={hasActions ? rowActions : undefined}
        empty={
          <EmptyState
            title={filtering ? `No ${entityLabel}s match your filters` : `No ${entityLabel}s yet`}
            description={filtering ? "Try a different search term or clear the filters." : `Create your first ${entityLabel} to get started.`}
            action={filtering ? <Button variant="secondary" onClick={reset}>Clear filters</Button> : emptyAction}
          />
        }
      />
      )}

      {data.total > 0 && (
        <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} onPage={setPage} />
      )}
    </Card>
  );
}
