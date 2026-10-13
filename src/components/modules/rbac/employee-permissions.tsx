"use client";

import { useMemo, useState } from "react";
import { LuInfo as Info } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/fields";
import { ErrorState, NotFoundRecord, PageHeader } from "@/components/admin/page-parts";
import { useUnsavedChangesGuard } from "@/components/admin/dialogs";
import { useBreadcrumbLabel } from "@/components/admin/use-breadcrumb-label";
import { ACTION_LABEL, getResource, type Action } from "@/lib/authz/catalog";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { useAuth } from "@/lib/auth";
import { PermissionTree, diffKeys, effectiveKeys, type Overrides } from "./permission-tree";
import { RoleChips } from "./shared";
import type { EmployeePermissions } from "./types";
import { CardSkeleton } from "@/components/admin/skeletons";

const label = (key: string) => {
  const i = key.lastIndexOf(":");
  return `${getResource(key.slice(0, i))?.label ?? key.slice(0, i)}: ${ACTION_LABEL[key.slice(i + 1) as Action] ?? key.slice(i + 1)}`;
};
/** Removing access to these needs an extra, explicit warning. */
const CRITICAL = ["users:", "user_permissions:", "roles:", "settings_", "activity_logs:"];

export function EmployeePermissionsPage({ id }: { id: string }) {
  const perms = useApi<EmployeePermissions>(`/api/users/${id}/permissions`);
  useBreadcrumbLabel(perms.data?.user.name);
  if (perms.error?.status === 404) return <NotFoundRecord what="Employee" backHref="/admin/users" backLabel="Back to employees" />;
  if (perms.error) return <ErrorState title="Couldn't load permissions" description={perms.error.message} onRetry={() => void perms.reload()} />;
  if (!perms.data) return <><PageHeader title="Page access" /><CardSkeleton lines={10} /></>;
  return <Editor key={perms.data.overrides.map((o) => `${o.resource}:${o.action}:${o.effect}`).join("|")} data={perms.data} id={id} onSaved={() => void perms.reload()} />;
}

function Editor({ data, id, onSaved }: { data: EmployeePermissions; id: string; onSaved: () => void }) {
  const { user } = useAuth();
  const toMap = (list: EmployeePermissions["overrides"]): Overrides => Object.fromEntries(list.map((o) => [`${o.resource}:${o.action}`, { effect: o.effect, scope: o.scope }]));
  const original = useMemo(() => toMap(data.overrides), [data.overrides]);
  const [overrides, setOverrides] = useState<Overrides>(original);
  const [reviewing, setReviewing] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(overrides) !== JSON.stringify(original);
  const { navigate, dialog } = useUnsavedChangesGuard(dirty && !saving);

  const self = data.user.id === user?.id;
  const readOnly = !data.actorCanManage || data.user.isSuperAdmin || self;
  const before = useMemo(() => effectiveKeys(data.inherited, original), [data.inherited, original]);
  const after = useMemo(() => effectiveKeys(data.inherited, overrides), [data.inherited, overrides]);
  const diff = diffKeys(before, after);
  const criticalRemoved = diff.removed.filter((k) => CRITICAL.some((c) => k.startsWith(c)));

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/users/${id}/permissions`, {
        method: "PUT",
        body: { overrides: Object.entries(overrides).map(([key, o]) => ({ resource: key.slice(0, key.lastIndexOf(":")), action: key.slice(key.lastIndexOf(":") + 1), effect: o.effect, scope: o.scope })), reason: reason || undefined },
      });
      toast.success("Permissions saved", { description: "The change applies on the employee's next request." });
      setReviewing(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Could not save permissions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title={`Page access: ${data.user.name}`} description={`${data.user.employeeId} · allocate or revoke pages and actions for this employee.`} />
      {data.user.isSuperAdmin && <Notice>This account is a Super Admin. Super Admin access is full and cannot be changed with individual overrides.</Notice>}
      {self && !data.user.isSuperAdmin && <Notice>You cannot change your own permissions. Ask another administrator.</Notice>}
      {!self && !data.actorCanManage && !data.user.isSuperAdmin && <Notice>You can view this employee&apos;s access but you are not allowed to change it.</Notice>}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <span className="font-medium text-ink">Assigned roles:</span><RoleChips roles={data.roles} max={10} />
          <span className="ml-auto text-xs text-muted">Roles are combined. Individual denials always win.</span>
        </div>
      </Card>

      <PermissionTree mode="employee" inherited={data.inherited} overrides={overrides} onOverridesChange={setOverrides} delegable={data.delegable} readOnly={readOnly} />

      {!readOnly && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <p className="text-sm text-muted" aria-live="polite">{dirty ? `${diff.added.length} added, ${diff.removed.length} removed${diff.scoped.length ? `, ${diff.scoped.length} scope changed` : ""}` : "No unsaved changes"}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate(`/admin/users/${id}`)}>{dirty ? "Cancel" : "Back"}</Button>
            <Button variant="secondary" disabled={!dirty} onClick={() => setOverrides(original)}>Discard changes</Button>
            <Button disabled={!dirty} onClick={() => setReviewing(true)}>Review & save</Button>
          </div>
        </div>
      )}
      {dialog}

      <Dialog open={reviewing} onOpenChange={setReviewing}>
        <DialogContent className="max-w-xl overflow-y-auto p-6">
          <DialogTitle>Review permission changes</DialogTitle>
          <DialogDescription>Effective permissions for {data.user.name}, before and after.</DialogDescription>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Compare title="Will be granted" tone="success" keys={diff.added} />
            <Compare title="Will be removed" tone="danger" keys={diff.removed} />
          </div>
          {diff.scoped.length > 0 && <Compare title="Scope changes" tone="info" keys={diff.scoped} />}
          {criticalRemoved.length > 0 && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-warn-50 p-3 text-sm text-warn-600" role="alert">
              <strong>Critical access is being removed</strong> ({criticalRemoved.map(label).join(", ")}). The employee may lose the ability to administer users or settings.
            </p>
          )}
          <div className="mt-4">
            <Label htmlFor="reason">Reason (optional, saved in the permission history)</Label>
            <Textarea id="reason" rows={2} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReviewing(false)}>Keep editing</Button>
            <Button variant={criticalRemoved.length ? "danger" : "primary"} loading={saving} onClick={() => save()}>Confirm and save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex gap-2.5 rounded-lg border border-brand-200 bg-brand-50 p-3 text-[13px] text-brand-700" role="note"><Info className="mt-0.5 size-4 shrink-0" aria-hidden /><p>{children}</p></div>;
}

function Compare({ title, keys, tone }: { title: string; keys: string[]; tone: "success" | "danger" | "info" }) {
  const cls = { success: "text-success-600", danger: "text-danger-600", info: "text-brand-700" }[tone];
  return (
    <Card>
      <CardHeader title={`${title} (${keys.length})`} className="px-4 py-2.5" />
      <ul className="max-h-48 space-y-1 overflow-y-auto p-3 text-sm">
        {keys.length === 0 ? <li className="text-muted">None</li> : keys.map((k) => <li key={k} className={cls}>{label(k)}</li>)}
      </ul>
    </Card>
  );
}
