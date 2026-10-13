"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { isApiMode } from "@/lib/api/client";
import type { CrudService } from "@/lib/mock/collection";
import type { BaseEntity } from "@/types/common";
import { LuTriangleAlert as AlertTriangle, LuInbox as Inbox, LuSearch as SearchIcon, LuX as X, LuChevronLeft as ChevronLeft, LuChevronRight as ChevronRight } from "react-icons/lu";
import type { IconType } from "react-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FormSkeleton, Skeleton } from "@/components/admin/skeletons";
/* ───────────────────────── PageHeader ───────────────────────── */
export function PageHeader({
  title, description, actions, className,
}: { title: string; description?: string; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ───────────────────────── StatCard ───────────────────────── */
export function StatCard({
  label, value, icon: Icon, href, hint, tone = "info",
}: { label: string; value: number | string; icon: IconType; href?: string; hint?: string; tone?: "info" | "success" | "warn" | "danger" | "neutral" }) {
  const toneCls = {
    info: "bg-brand-50 text-brand-600",
    success: "bg-success-50 text-success-600",
    warn: "bg-warn-50 text-warn-600",
    danger: "bg-danger-50 text-danger-600",
    neutral: "bg-slate-100 text-slate-600",
  }[tone];
  const body = (
    <Card className={cn("flex items-center gap-3.5 p-4", href && "transition-colors hover:border-brand-200")}>
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", toneCls)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-semibold leading-none tracking-tight text-ink tabular-nums">{value}</div>
        <div className="mt-1.5 truncate text-[13px] text-muted">{label}</div>
        {hint && <div className="truncate text-xs text-faint">{hint}</div>}
      </div>
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-xl" aria-label={`${label}: ${value}`}>
      {body}
    </Link>
  ) : body;
}

/* ───────────────────────── SearchInput ───────────────────────── */
export function SearchInput({
  value, onChange, placeholder = "Search…", className,
}: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-8 text-sm placeholder:text-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-faint hover:text-ink">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── FilterBar ───────────────────────── */
export interface FilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export function FilterBar({
  search, onSearch, searchPlaceholder, filters, values, onChange, onReset, extra,
}: {
  search: string; onSearch: (v: string) => void; searchPlaceholder?: string;
  filters: FilterDef[]; values: Record<string, string>; onChange: (key: string, v: string) => void;
  onReset: () => void; extra?: React.ReactNode;
}) {
  const dirty = !!search || Object.values(values).some((v) => v && v !== "all");
  return (
    <div className="flex flex-col gap-2 border-b border-line p-4 lg:flex-row lg:items-center">
      <SearchInput value={search} onChange={onSearch} placeholder={searchPlaceholder} className="lg:w-72" />
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {filters.map((f) => (
          <select
            key={f.key}
            aria-label={f.label}
            value={values[f.key] ?? "all"}
            onChange={(e) => onChange(f.key, e.target.value)}
            className="h-9 rounded-md border border-line bg-white px-3 pr-8 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="all">{f.label}: All</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        {dirty && <Button variant="ghost" size="sm" onClick={onReset}><X className="size-3.5" /> Reset</Button>}
      </div>
      {extra}
    </div>
  );
}

/* ───────────────────────── Pagination ───────────────────────── */
export function Pagination({
  page, pageCount, total, pageSize, onPage,
}: { page: number; pageCount: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
  );
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row">
      <p className="text-[13px] text-muted" aria-live="polite">
        Showing <span className="font-medium text-ink">{from}–{to}</span> of <span className="font-medium text-ink">{total}</span>
      </p>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="size-8" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Button>
        {pages.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            {i > 0 && p - pages[i - 1] > 1 && <span className="px-1 text-faint">…</span>}
            <Button
              variant={p === page ? "primary" : "ghost"}
              size="icon"
              className="size-8 text-[13px]"
              onClick={() => onPage(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </Button>
          </span>
        ))}
        <Button variant="outline" size="icon" className="size-8" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" />
        </Button>
      </nav>
    </div>
  );
}

/* ───────────────────────── Empty / Loading / Error ───────────────────────── */
export function EmptyState({
  title, description, action, icon: Icon = Inbox,
}: { title: string; description?: string; action?: React.ReactNode; icon?: IconType }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-canvas text-faint"><Icon className="size-6" aria-hidden /></span>
      <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3 p-4", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong", description = "We couldn't load this content.", onRetry,
}: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center" role="alert">
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-50 text-danger-600"><AlertTriangle className="size-6" aria-hidden /></span>
      <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {onRetry && <Button variant="secondary" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/**
 * Shown when a dynamic route's record is not (yet) available. With a remote-backed `service` it first shows a loading
 * skeleton, then the load error if the request failed, and only then "not found" (so a slow request is never mistaken for a missing record).
 */
export function NotFoundRecord<T extends BaseEntity>({ what, backHref, backLabel, service }: { what: string; backHref: string; backLabel: string; service?: CrudService<T> }) {
  const subscribe = service?.subscribe ?? (() => () => undefined);
  const ready = useSyncExternalStore(subscribe, () => service?.ready?.() ?? true, () => true);
  const loadError = useSyncExternalStore(subscribe, () => service?.loadError?.() ?? null, () => null);
  if (!ready) return <FormSkeleton />;
  if (loadError) return <Card><ErrorState title={`Couldn't load ${what.toLowerCase()}`} description={loadError} onRetry={() => void service?.reload?.()} /></Card>;
  return (
    <Card>
      <EmptyState
        title={`${what} not found`}
        description={isApiMode ? "It may have been deleted, or you may not have access to it." : "It may have been deleted. Note: mock data resets when the page is reloaded."}
        action={
          <Link href={backHref} className="text-sm font-medium text-brand-600 hover:underline">
            ← {backLabel}
          </Link>
        }
      />
    </Card>
  );
}
