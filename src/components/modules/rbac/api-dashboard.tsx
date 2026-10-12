"use client";

import Link from "next/link";
import {
  Activity, ArrowRight, Boxes, Briefcase, CheckCircle2, Clock, FileEdit, FolderKanban, Globe2, Handshake, Inbox, LayoutDashboard,
  MapPin, MessageSquare, Newspaper, Package, UserPlus, Users, type LucideIcon,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, PageHeader, StatCard } from "@/components/admin/page-parts";
import { useApi } from "@/lib/api/use-api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

type Widget =
  | { key: string; label: string; kind: "metric"; href: string; value: number }
  | { key: string; label: string; kind: "activity"; href: string; items: { id: string; actorName: string; action: string; entityType: string; entityLabel: string; createdAt: string }[] };

interface DashboardData {
  widgets: Widget[];
  quickActions: { key: string; label: string; href: string }[];
}

const ICONS: Record<string, LucideIcon> = {
  total_products: Package, published_products: CheckCircle2, draft_products: FileEdit, pending_reviews: Clock, active_commodities: Boxes,
  active_opportunities: Handshake, new_rfqs: Inbox, assigned_rfqs: Inbox, new_enquiries: MessageSquare, assigned_enquiries: MessageSquare,
  open_applications: Users, published_insights: Newspaper, global_locations: Globe2,
};
const QUICK_ICONS: Record<string, LucideIcon> = { add_product: Package, create_post: Newspaper, add_project: FolderKanban, add_location: MapPin, add_commodity: Boxes, review_enquiries: Inbox, review_rfqs: Briefcase, add_employee: UserPlus };

/**
 * Database-mode dashboard. The server decides which widgets this employee sees and computes numbers ONLY for
 * those, honouring assigned-only scopes, so nothing here can reveal data the employee may not access.
 */
export function ApiDashboard() {
  const { user } = useAuth();
  const d = useApi<DashboardData>("/api/dashboard");
  if (d.error) return <ErrorState title="Couldn't load the dashboard" description={d.error.message} onRetry={() => void d.reload()} />;
  const metrics = (d.data?.widgets ?? []).filter((w): w is Extract<Widget, { kind: "metric" }> => w.kind === "metric");
  const activity = (d.data?.widgets ?? []).find((w): w is Extract<Widget, { kind: "activity" }> => w.kind === "activity");

  return (
    <>
      <PageHeader title="Dashboard" description={user ? `Welcome back, ${user.name.split(" ")[0]}. Showing what your role gives you access to.` : undefined} />
      {d.loading && !d.data && <div className="h-24 animate-pulse rounded-xl bg-slate-100" role="status" aria-label="Loading" />}
      {d.data && d.data.widgets.length === 0 && d.data.quickActions.length === 0 && (
        <Card><EmptyState icon={LayoutDashboard} title="Nothing to show yet" description="No dashboard widgets are available for your account. Your administrator can grant access to pages and widgets." /></Card>
      )}
      {metrics.length > 0 && (
        <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((w) => <StatCard key={w.key} label={w.label} value={w.value} icon={ICONS[w.key] ?? Package} href={w.href} />)}
        </section>
      )}
      {d.data && d.data.quickActions.length > 0 && (
        <section aria-label="Quick actions" className="mt-6">
          <Card>
            <CardHeader title="Quick Actions" />
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
              {d.data.quickActions.map((a) => {
                const Icon = QUICK_ICONS[a.key] ?? Package;
                return (
                  <Link key={a.key} href={a.href} className="flex flex-col items-center gap-2 rounded-lg border border-line px-3 py-4 text-center text-[13px] font-medium text-ink transition-colors hover:border-brand-200 hover:bg-brand-50">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Icon className="size-[18px]" aria-hidden /></span>
                    {a.label}
                  </Link>
                );
              })}
            </div>
          </Card>
        </section>
      )}
      {activity && (
        <Card className="mt-6">
          <CardHeader title="Recent Activity" action={<Link href={activity.href} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:underline">All logs <ArrowRight className="size-3.5" /></Link>} />
          {activity.items.length === 0 ? <p className="p-5 text-sm text-muted">No activity yet.</p> : (
            <ul className="divide-y divide-line">
              {activity.items.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <Activity className="size-4 shrink-0 text-faint" aria-hidden />
                  <span className="min-w-0 flex-1 truncate"><span className="font-medium text-ink">{a.actorName}</span> {a.action.replace("_", " ")} {a.entityType.toLowerCase()} <span className="font-medium text-ink">{a.entityLabel}</span></span>
                  <span className="shrink-0 text-xs text-muted">{formatDate(a.createdAt, true)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
