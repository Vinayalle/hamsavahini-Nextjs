import { cn } from "@/lib/utils";

/**
 * Loading skeletons: grey shapes shaped like the real screens, shown instead of a blank page or an "empty" message while the session is being
 * checked, a page is loading, or data is still on its way. Pure markup (no hooks), so they can be rendered on the server and are in the very
 * first HTML. The shimmer (`.skeleton`) is defined in the admin stylesheet.
 */
export function Skeleton({ className, dark }: { className?: string; dark?: boolean }) {
  return <div aria-hidden className={cn("skeleton rounded-md", dark && "skeleton-dark", className)} />;
}

/** Announces "Loading…" to screen readers once and marks the region busy. */
function Status({ children, className, label = "Loading…" }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

const cardCls = "rounded-xl border border-line bg-surface shadow-card";

/** A white card with a title line and `lines` rows of text. */
export function CardSkeleton({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <Status className={cn(cardCls, "p-5", className)}>
      <Skeleton className="mb-5 h-5 w-40" />
      <div className="space-y-3.5">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={cn("h-4", i % 3 === 0 ? "w-full" : i % 3 === 1 ? "w-5/6" : "w-2/3")} />
        ))}
      </div>
    </Status>
  );
}

/** The dashboard's summary tiles (icon, number, label), three across like the real ones. */
export function StatGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn(cardCls, "flex items-center gap-4 p-5")}>
          <Skeleton className="size-12 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Everything under the dashboard title: summary tiles, quick actions and recent activity. */
export function DashboardBodySkeleton() {
  return (
    <Status className="space-y-6" label="Loading your dashboard…">
      <StatGridSkeleton />
      <div className={cn(cardCls)} aria-hidden>
        <div className="border-b border-line px-5 py-4"><Skeleton className="h-5 w-32" /></div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-2.5 rounded-lg border border-line px-3 py-4">
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="h-3.5 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className={cn(cardCls)} aria-hidden>
        <div className="border-b border-line px-5 py-4"><Skeleton className="h-5 w-36" /></div>
        <div className="divide-y divide-line">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <Skeleton className="size-4 shrink-0 rounded" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          ))}
        </div>
      </div>
    </Status>
  );
}

/** A table: header row plus `rows` rows. `columns` is how many cells each row has. */
export function TableSkeleton({ columns = 5, rows = 8 }: { columns?: number; rows?: number }) {
  return (
    <Status>
      <div className="overflow-hidden">
        <div className="flex items-center gap-6 border-b border-line bg-canvas px-4 py-3" aria-hidden>
          {Array.from({ length: columns }, (_, c) => <Skeleton key={c} className={cn("h-3.5", c === 0 ? "w-32" : "w-20", c > 2 && "hidden md:block")} />)}
        </div>
        <div className="divide-y divide-line" aria-hidden>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="flex items-center gap-6 px-4 py-3.5">
              {Array.from({ length: columns }, (_, c) =>
                c === 0 ? (
                  <div key={c} className="flex min-w-0 flex-1 items-center gap-3">
                    <Skeleton className="size-9 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-3/5" /><Skeleton className="h-3 w-2/5" /></div>
                  </div>
                ) : c === columns - 1 ? (
                  <Skeleton key={c} className="size-8 rounded-md" />
                ) : (
                  <Skeleton key={c} className={cn("h-4 w-20", c > 2 && "hidden md:block")} />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    </Status>
  );
}

/** A grid of square pictures with a caption (media library, product images). */
export function ImageGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <Status>
      <ul className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="overflow-hidden rounded-lg border border-line">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="space-y-2 p-2.5"><Skeleton className="h-3.5 w-4/5" /><Skeleton className="h-3 w-1/3" /></div>
          </li>
        ))}
      </ul>
    </Status>
  );
}

/** A few lines with a dot, for timelines and short lists inside a card. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Status className="space-y-4 p-5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-start gap-3" aria-hidden>
          <Skeleton className="mt-1 size-3 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-1/3" /></div>
        </div>
      ))}
    </Status>
  );
}

/** Form sections: labelled inputs in a two-column grid. */
export function FormSkeleton({ sections = 2 }: { sections?: number }) {
  return (
    <Status className="space-y-5">
      {Array.from({ length: sections }, (_, s) => (
        <div key={s} className={cn(cardCls, "p-6")} aria-hidden>
          <Skeleton className="mb-5 h-5 w-44" />
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-end gap-2" aria-hidden><Skeleton className="h-9 w-24" /><Skeleton className="h-9 w-32" /></div>
    </Status>
  );
}

/** A record's detail page: a summary card with key/value rows next to a second card. */
export function DetailSkeleton() {
  return (
    <Status className="grid gap-5 lg:grid-cols-3">
      <div className={cn(cardCls, "p-6 lg:col-span-2")} aria-hidden>
        <div className="mb-6 flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="space-y-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-3.5 w-32" /></div>
        </div>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-4 w-3/4" /></div>
          ))}
        </div>
      </div>
      <div className={cn(cardCls, "p-6")} aria-hidden>
        <Skeleton className="mb-5 h-5 w-32" />
        <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
      </div>
    </Status>
  );
}

/** Title, description and a primary action, as at the top of every admin page. */
function HeaderSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-9 w-32 rounded-md" />
    </div>
  );
}

export type SkeletonVariant = "list" | "dashboard" | "form";

/** The content area of an admin page, under the shell: heading, then a table (list), dashboard tiles (dashboard) or form sections (form). */
export function PageSkeleton({ variant = "list" }: { variant?: SkeletonVariant }) {
  return (
    <Status className="space-y-6">
      <HeaderSkeleton />
      {variant === "dashboard" && <DashboardBodySkeleton />}
      {variant === "form" && <FormSkeleton />}
      {variant === "list" && (
        <div className={cardCls}>
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-4" aria-hidden>
            <Skeleton className="h-10 w-72 max-w-full" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
          <TableSkeleton />
        </div>
      )}
    </Status>
  );
}

/** The whole signed-in application: sidebar, header and a page. Shown while the session is checked, so a refresh never shows a blank screen. */
export function AppShellSkeleton({ variant = "list" }: { variant?: SkeletonVariant }) {
  return (
    <div className="flex min-h-screen" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Checking your session…</span>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-bark-900 lg:block" aria-hidden>
        <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
          <Skeleton dark className="size-8 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton dark className="h-3.5 w-24" />
            <Skeleton dark className="h-2.5 w-16" />
          </div>
        </div>
        <div className="space-y-6 px-3 py-5">
          {[4, 5, 4].map((count, g) => (
            <div key={g} className="space-y-2.5">
              <Skeleton dark className="mx-3 h-2.5 w-24" />
              {Array.from({ length: count }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                  <Skeleton dark className="size-[18px] rounded" />
                  <Skeleton dark className={cn("h-3.5", i % 2 ? "w-28" : "w-36")} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6" aria-hidden>
          <Skeleton className="size-9 rounded-md lg:hidden" />
          <Skeleton className="hidden h-4 w-48 md:block" />
          <div className="flex-1" />
          <Skeleton className="hidden h-10 w-72 rounded-lg md:block" />
          <Skeleton className="size-9 rounded-full" />
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-10 rounded-full" />
            <div className="hidden space-y-1.5 sm:block">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <PageSkeleton variant={variant} />
        </main>
      </div>
    </div>
  );
}

/** Centered card of the sign-in / password pages. */
export function AuthSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <Status className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <div className="mb-6 flex items-center gap-2.5" aria-hidden>
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="h-5 w-28" />
        </div>
        <div aria-hidden>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-3 h-4 w-64 max-w-full" />
          <div className="mt-8 space-y-5">
            <div className="space-y-2"><Skeleton className="h-3.5 w-16" /><Skeleton className="h-10 w-full" /></div>
            <div className="space-y-2"><Skeleton className="h-3.5 w-20" /><Skeleton className="h-10 w-full" /></div>
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </Status>
    </main>
  );
}
