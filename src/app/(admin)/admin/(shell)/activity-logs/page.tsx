"use client";

import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import type { Column } from "@/components/admin/data-table";
import { ServerPagedList } from "@/components/admin/server-paged-list";
import { isApiMode } from "@/lib/api/client";
import { activityService } from "@/lib/services";
import { formatDate } from "@/lib/utils";
import type { ActivityLog } from "@/types/entities";

const TONE: Record<string, "success" | "info" | "neutral" | "danger" | "warn" | "purple"> = {
  created: "success", published: "success", updated: "info", status_changed: "info", archived: "neutral", deleted: "danger", login: "neutral", logout: "neutral",
  login_failed: "danger", token_reuse: "danger", mfa_failed: "danger", otp_failed: "danger", access_changed: "purple", invited: "info", password_reset: "warn",
  mfa_enrolled: "success", mfa_disabled: "warn", mfa_reset: "warn", account_activated: "success", viewed_sensitive: "warn", reauth: "neutral", otp_requested: "neutral", otp_verified: "neutral",
};
const ACTIONS = Object.keys(TONE);

export default function ActivityLogsPage() {
  const columns: Column<ActivityLog>[] = [
    { key: "when", header: "When", sortKey: "createdAt", cell: (a) => <span className="whitespace-nowrap text-muted">{formatDate(a.createdAt, true)}</span> },
    { key: "actor", header: "Admin", sortKey: "actor", cell: (a) => <span className="font-medium text-ink">{a.actor}</span> },
    { key: "action", header: "Action", sortKey: "action", cell: (a) => <StatusBadge status={a.action} tone={TONE[a.action] ?? "neutral"} /> },
    { key: "entity", header: "Record", cell: (a) => (<div className="min-w-0"><span className="block max-w-sm truncate">{a.entityLabel}</span><span className="text-xs text-muted">{a.entityType}{a.detail ? ` · ${a.detail}` : ""}</span></div>) },
  ];
  if (isApiMode) {
    return (
      <>
        <PageHeader title="Activity Logs" description="Tamper-evident audit trail of administrative and security events, recorded by the server." />
        <ServerPagedList<ActivityLog>
          path="/api/activity-logs" entityLabel="log entry" columns={columns} pageSize={25} defaultSort={{ by: "createdAt", dir: "desc" }}
          searchPlaceholder="Search admin, record or detail…"
          filters={[{ key: "action", label: "Action", options: ACTIONS.map((a) => ({ value: a, label: a.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) })) }]}
        />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Activity Logs" description="Audit trail of administrative actions. Entries made in this session are added as you work." />
      <ResourceList
        service={activityService} entityLabel="log entry" nameOf={(a) => a.entityLabel} columns={columns} deletable={false} pageSize={15}
        defaultSort={{ by: "createdAt", dir: "desc" }} searchPlaceholder="Search admin, record or detail…"
        filters={[
          { key: "action", label: "Action", options: ACTIONS.map((a) => ({ value: a, label: a.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase()) })) },
          { key: "actor", label: "Admin", options: ["Rahul Varma", "Anita Das", "Priya Menon", "Karthik Rao"].map((v) => ({ value: v, label: v })) },
        ]}
      />
    </>
  );
}
