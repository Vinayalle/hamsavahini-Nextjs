"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, MoreHorizontal, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/fields";
import {
  DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import { LoadingSkeleton } from "./page-parts";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Field name passed to the service's sort. Omit for non-sortable columns. */
  sortKey?: string;
  className?: string;
  /** Hide the column below this breakpoint. */
  hideBelow?: "sm" | "md" | "lg";
}

export interface SortState {
  by: string;
  dir: "asc" | "desc";
}

const hide = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sort?: SortState;
  onSort?: (s: SortState) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  rowActions?: (row: T) => React.ReactNode;
  loading?: boolean;
  empty?: React.ReactNode;
  caption: string;
}

export function DataTable<T>({
  columns, rows, rowKey, sort, onSort, selectable, selected, onSelectedChange, rowActions, loading, empty, caption,
}: DataTableProps<T>) {
  if (loading) return <LoadingSkeleton />;
  if (rows.length === 0) return <>{empty}</>;

  const pageIds = rows.map(rowKey);
  const allSelected = !!selected && pageIds.every((id) => selected.has(id));
  const someSelected = !!selected && pageIds.some((id) => selected.has(id));

  const toggleAll = () => {
    if (!selected || !onSelectedChange) return;
    const next = new Set(selected);
    pageIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
    onSelectedChange(next);
  };
  const toggleOne = (id: string) => {
    if (!selected || !onSelectedChange) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };

  return (
    <div className="scroll-thin relative overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-canvas/60 text-xs font-medium uppercase tracking-wide text-muted">
            {selectable && (
              <th scope="col" className="w-10 px-4 py-2.5">
                <Checkbox
                  aria-label="Select all rows on this page"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                  onChange={toggleAll}
                />
              </th>
            )}
            {columns.map((c) => {
              const active = !!c.sortKey && sort?.by === c.sortKey;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                  className={cn("px-4 py-2.5", c.hideBelow && hide[c.hideBelow], c.className)}
                >
                  {c.sortKey && onSort ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink"
                      onClick={() => onSort({ by: c.sortKey!, dir: active && sort!.dir === "asc" ? "desc" : "asc" })}
                    >
                      {c.header}
                      {active ? (sort!.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ChevronsUpDown className="size-3 opacity-50" />}
                    </button>
                  ) : c.header}
                </th>
              );
            })}
            {rowActions && <th scope="col" className="w-12 px-4 py-2.5"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const id = rowKey(row);
            return (
              <tr key={id} className={cn("transition-colors hover:bg-canvas/60", selected?.has(id) && "bg-brand-50/50")}>
                {selectable && (
                  <td className="px-4 py-3">
                    <Checkbox aria-label="Select row" checked={selected?.has(id) ?? false} onChange={() => toggleOne(id)} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-3 align-middle", c.hideBelow && hide[c.hideBelow], c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
                {rowActions && <td className="px-4 py-3 text-right">{rowActions(row)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────── RowActions ───────────────────────── */
export interface RowActionItem {
  label: string;
  icon?: LucideIcon;
  href?: string;
  onSelect?: () => void;
  destructive?: boolean;
  hidden?: boolean;
  separatorBefore?: boolean;
}

export function RowActions({ items, label = "Row actions" }: { items: RowActionItem[]; label?: string }) {
  const visible = items.filter((i) => !i.hidden);
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={label}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownTrigger>
      <DropdownContent>
        {visible.map((it, i) => (
          <span key={it.label}>
            {it.separatorBefore && i > 0 && <DropdownSeparator />}
            {it.href ? (
              <DropdownItem asChild>
                <Link href={it.href}>{it.icon && <it.icon className="size-4" />} {it.label}</Link>
              </DropdownItem>
            ) : (
              <DropdownItem destructive={it.destructive} onSelect={it.onSelect}>
                {it.icon && <it.icon className="size-4" />} {it.label}
              </DropdownItem>
            )}
          </span>
        ))}
      </DropdownContent>
    </DropdownMenu>
  );
}
