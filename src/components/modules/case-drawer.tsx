"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/fields";
import { DetailList, NotesPanel } from "@/components/admin/detail-parts";
import { StatusBadge, statusLabel } from "@/components/admin/status-badge";
import { useConfirm } from "@/components/admin/dialogs";
import { useAll } from "@/hooks/use-resource";
import { ApiClientError, apiFetch, isApiMode } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import type { CrudService } from "@/lib/mock/collection";
import { userService } from "@/lib/services";
import { uid } from "@/lib/utils";
import type { BaseEntity } from "@/types/common";
import type { InternalNote } from "@/types/entities";

interface CaseRecord extends BaseEntity {
  status: string;
  notes: InternalNote[];
  assignedTo?: string;
  assignedToId?: string | null;
}

const errMessage = (e: unknown) => (e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : "Something went wrong");

/** People a record can be assigned to. Mock: the mock admin list. API: /api/assignees (id + name only; 403 without assign rights). */
function useAssignees(enabled: boolean): { id: string; name: string }[] {
  const mockUsers = useAll(userService);
  const [remote, setRemote] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!isApiMode || !enabled) return;
    let alive = true;
    apiFetch<{ items: { id: string; name: string }[] }>("/api/assignees").then((r) => alive && setRemote(r.items)).catch(() => alive && setRemote([]));
    return () => { alive = false; };
  }, [enabled]);
  return isApiMode ? remote : mockUsers.filter((u) => u.status === "active").map((u) => ({ id: u.name, name: u.name }));
}

/**
 * Workflow body shared by RFQs, enquiries and applications: status transitions (with
 * confirmation for terminal states), assignee and internal notes. Module-specific
 * details are passed in as `details`. In api mode every control is also enforced by the server;
 * the controls here are hidden when the signed-in employee lacks the matching permission.
 */
export function CaseWorkflow<T extends CaseRecord>({
  service, record, name, resource, transitions, finalStatuses = [], details, assignable = true, children,
}: {
  service: CrudService<T>; record: T; name: string;
  /** Permission resource (e.g. "rfqs") used to hide controls the employee cannot use. */
  resource?: string;
  /** Allowed next statuses from the current one. */
  transitions: (current: string) => string[];
  finalStatuses?: string[];
  details: { label: string; value: React.ReactNode }[];
  assignable?: boolean;
  children?: React.ReactNode;
}) {
  const confirm = useConfirm();
  const { can } = useAuth();
  const allowed = (action: string) => !isApiMode || !resource || can(resource, action);
  const canStatus = allowed("change_status");
  const canAssign = assignable && allowed("assign");
  const canNote = allowed("edit");
  const assignees = useAssignees(canAssign);

  const move = async (to: string) => {
    if (finalStatuses.includes(to)) {
      const ok = await confirm({
        title: `Mark as ${statusLabel(to)}?`,
        description: `“${name}” will be moved to ${statusLabel(to).toLowerCase()}. You can reopen it later.`,
        confirmLabel: `Mark ${statusLabel(to)}`,
        destructive: to === "rejected" || to === "lost" || to === "spam",
      });
      if (!ok) return;
    }
    try {
      await service.setStatus(record.id, to);
      toast.success(`Moved to ${statusLabel(to)}`);
    } catch (e) {
      toast.error(errMessage(e));
    }
  };

  const assign = async (value: string) => {
    try {
      const patch = isApiMode ? { assignedToId: value || null } : { assignedTo: value || undefined };
      await service.update(record.id, patch as never);
      toast.success(value ? `Assigned to ${assignees.find((a) => a.id === value)?.name ?? value}` : "Unassigned");
    } catch (e) {
      toast.error(errMessage(e));
    }
  };

  const next = canStatus ? transitions(record.status) : [];
  const assignedValue = isApiMode ? record.assignedToId ?? "" : record.assignedTo ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Current status</span>
        <StatusBadge status={record.status} />
      </div>

      {next.length > 0 && (
        <div>
          <Label>Move to</Label>
          <div className="flex flex-wrap gap-2">
            {next.map((s) => (
              <Button key={s} size="sm" variant="secondary" onClick={() => void move(s)}>{statusLabel(s)}</Button>
            ))}
          </div>
        </div>
      )}

      {canAssign ? (
        <div>
          <Label htmlFor="assignee">Assigned to</Label>
          <Select id="assignee" value={assignedValue} onChange={(e) => void assign(e.target.value)}>
            <option value="">Unassigned</option>
            {assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </div>
      ) : assignable && record.assignedTo ? (
        <p className="text-sm text-muted">Assigned to <span className="font-medium text-ink">{record.assignedTo}</span></p>
      ) : null}

      <DetailList items={details} />
      {children}

      {canNote ? (
        <NotesPanel
          notes={record.notes}
          onAdd={async (text) => {
            try {
              await service.update(record.id, { notes: [...record.notes, { id: uid("note"), author: "Rahul Varma", text, createdAt: new Date().toISOString() }] } as never);
              toast.success("Note added");
            } catch (e) {
              toast.error(errMessage(e));
              throw e;
            }
          }}
        />
      ) : null}
    </div>
  );
}
