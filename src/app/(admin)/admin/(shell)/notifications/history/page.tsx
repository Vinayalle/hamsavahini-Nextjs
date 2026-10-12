"use client";

import { RotateCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import type { Column } from "@/components/admin/data-table";
import { useConfirm } from "@/components/admin/dialogs";
import { Button } from "@/components/ui/button";
import { ServerPagedList } from "@/components/admin/server-paged-list";
import { ApiClientError, apiFetch, isApiMode } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { notificationService } from "@/lib/services";
import { formatDate } from "@/lib/utils";
import type { NotificationLog } from "@/types/entities";

export default function NotificationHistoryPage() {
  const confirm = useConfirm();
  const { can } = useAuth();

  const columns: Column<NotificationLog>[] = [
    { key: "subject", header: "Email", sortKey: "subject", cell: (n) => (<div><span className="font-medium text-ink">{n.subject}</span><span className="block font-mono text-xs text-muted">{n.templateKey}</span></div>) },
    { key: "to", header: "Recipient", sortKey: "recipient", hideBelow: "sm", cell: (n) => n.recipient },
    { key: "status", header: "Status", sortKey: "status", cell: (n) => (<div><StatusBadge status={n.status} />{n.error && <span className="mt-1 block text-xs text-danger-600">{n.error}</span>}</div>) },
    { key: "sent", header: "Time", sortKey: "createdAt", hideBelow: "md", cell: (n) => <span className="text-muted">{formatDate(n.createdAt, true)}</span> },
  ];

  if (isApiMode) {
    const retry = async (n: NotificationLog, reload: () => void) => {
      if (!(await confirm({ title: "Mark for retry?", description: `“${n.subject}” to ${n.recipient} will be marked as queued. This admin does not send email itself: a mail worker has to deliver queued items.`, confirmLabel: "Mark as queued" }))) return;
      try {
        await apiFetch(`/api/notifications/${n.id}`, { method: "PATCH", body: { status: "queued" } });
        toast.success("Marked as queued");
        reload();
      } catch (e) {
        toast.error(e instanceof ApiClientError ? e.message : "Could not update");
      }
    };
    return (
      <>
        <PageHeader title="Notification History" description="A record of emails the system has sent or attempted to send. Message bodies, codes and links are never stored here." />
        <ServerPagedList<NotificationLog>
          path="/api/notifications" entityLabel="notification" columns={columns} pageSize={25} defaultSort={{ by: "createdAt", dir: "desc" }}
          searchPlaceholder="Search recipient or email…"
          filters={[{ key: "status", label: "Status", options: [{ value: "sent", label: "Sent" }, { value: "queued", label: "Queued" }, { value: "failed", label: "Failed" }] }]}
          rowActions={(n, reload) => (n.status === "failed" && can("notification_history", "change_status") ? <Button size="sm" variant="secondary" onClick={() => void retry(n, reload)}><RotateCw className="size-3.5" /> Retry</Button> : null)}
        />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Notification History" description="A record of emails the system has sent or attempted to send." />
      <ResourceList
        service={notificationService} entityLabel="notification" nameOf={(n) => n.subject} columns={columns} deletable={false}
        defaultSort={{ by: "createdAt", dir: "desc" }} searchPlaceholder="Search recipient or email…"
        extraRowActions={(n) => [{
          label: "Retry send", icon: RotateCw, hidden: n.status !== "failed",
          onSelect: async () => {
            if (!(await confirm({ title: "Retry sending?", description: `Queue “${n.subject}” to ${n.recipient} again.`, confirmLabel: "Retry" }))) return;
            await notificationService.setStatus(n.id, "queued");
            toast.success("Queued for retry (mock — no email is sent)");
          },
        }]}
        filters={[{ key: "status", label: "Status", options: [{ value: "sent", label: "Sent" }, { value: "queued", label: "Queued" }, { value: "failed", label: "Failed" }] }]}
      />
    </>
  );
}
