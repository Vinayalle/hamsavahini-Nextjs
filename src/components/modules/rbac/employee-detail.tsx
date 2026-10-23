"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LuKeyRound as KeyRound, LuLayoutDashboard as LayoutDashboard, LuMail as Mail, LuPencil as Pencil, LuUserCheck as UserCheck, LuUserX as UserX } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/fields";
import { ActivityTimeline, DetailList, type TimelineEntry } from "@/components/admin/detail-parts";
import { ErrorState, NotFoundRecord, PageHeader } from "@/components/admin/page-parts";
import { StatusBadge } from "@/components/admin/status-badge";
import { useConfirm } from "@/components/admin/dialogs";
import { useBreadcrumbLabel } from "@/components/admin/use-breadcrumb-label";
import { ACTION_LABEL, MODULES, RESOURCES, type Action } from "@/lib/authz/catalog";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { useAuth } from "@/lib/auth";
import { cn, formatDate } from "@/lib/utils";
import { Avatar, EmployeeStatus, InviteLinkDialog, RoleChips } from "./shared";
import type { EmployeeDto, EmployeePermissions, HistoryItem, InviteResult, RoleDto } from "./types";
import { CardSkeleton, DetailSkeleton, ListSkeleton } from "@/components/admin/skeletons";

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "roles", label: "Assigned Roles" },
  { key: "permissions", label: "Page Permissions" },
  { key: "dashboard", label: "Dashboard Configuration" },
  { key: "activity", label: "Activity History" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const errMsg = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong");

const KIND_LABEL: Record<string, string> = {
  user_created: "Employee created", role_assigned: "Role assigned", role_removed: "Role removed", override_set: "Individual permission set",
  override_removed: "Individual permission removed", status_changed: "Account status changed", dashboard_changed: "Dashboard changed",
  role_permissions_changed: "Role permissions changed",
};

function describe(h: HistoryItem): string {
  const c = h.change as Record<string, unknown>;
  switch (h.kind) {
    case "role_assigned": case "role_removed": return `${KIND_LABEL[h.kind]}: ${String(c.role)}`;
    case "override_set": return `${String(c.permission)} → ${String(c.effect)}${c.reason ? ` (${String(c.reason)})` : ""}`;
    case "override_removed": return `${String(c.permission)} (was ${String(c.was)})`;
    case "status_changed": return `Status ${String(c.from)} → ${String(c.to)}${c.reason ? `: ${String(c.reason)}` : ""}`;
    default: return KIND_LABEL[h.kind] ?? h.kind;
  }
}

/* ───────────────────────── tabs ───────────────────────── */

function RolesTab({ employee, canAssign, onSaved }: { employee: EmployeeDto; canAssign: boolean; onSaved: () => void }) {
  const roles = useApi<{ items: RoleDto[] }>("/api/roles");
  const [selected, setSelected] = useState<string[]>(employee.roles.map((r) => r.id));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify(employee.roles.map((r) => r.id).sort());
  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/users/${employee.id}/roles`, { method: "PUT", body: { roleIds: selected } });
      toast.success("Roles updated");
      onSaved();
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };
  return (
    <Card>
      <CardHeader title="Assigned roles" description="Permissions from all assigned roles are combined; individual denials always win." />
      <div className="p-5">
        {roles.error && <ErrorState title="Couldn't load roles" description={roles.error.message} onRetry={() => void roles.reload()} />}
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Roles">
          {roles.data?.items.map((r) => (
            <li key={r.id}>
              <label className={cn("flex items-start gap-2.5 rounded-lg border p-3", selected.includes(r.id) ? "border-brand-200 bg-brand-50/40" : "border-line", canAssign && r.status === "active" ? "cursor-pointer hover:bg-canvas" : "opacity-70")}>
                <Checkbox className="mt-0.5" disabled={!canAssign || r.status === "inactive"} checked={selected.includes(r.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))} />
                <span><span className="block text-sm font-medium text-ink">{r.name}{r.status === "inactive" && <span className="ml-1 text-xs font-normal text-muted">(inactive)</span>}</span><span className="block text-xs text-muted">{r.description} · {r.permissionCount} permissions</span></span>
              </label>
            </li>
          ))}
        </ul>
        {canAssign && (
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" disabled={!dirty} onClick={() => setSelected(employee.roles.map((r) => r.id))}>Reset</Button>
            <Button disabled={!dirty} loading={saving} onClick={() => save()}>Save roles</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function PermissionsTab({ employee, canView, canManage }: { employee: EmployeeDto; canView: boolean; canManage: boolean }) {
  const perms = useApi<EmployeePermissions>(canView ? `/api/users/${employee.id}/permissions` : null);
  if (!canView) return <Card><div className="p-6 text-sm text-muted">You do not have permission to view permission assignments.</div></Card>;
  if (perms.error) return <Card><ErrorState title="Couldn't load permissions" description={perms.error.message} onRetry={() => void perms.reload()} /></Card>;
  const p = perms.data;
  if (!p) return <CardSkeleton lines={8} />;
  const byModule = MODULES.map((m) => ({
    m,
    rows: RESOURCES.filter((r) => r.module === m.key).map((r) => ({
      r,
      actions: r.actions.filter((a) => p.effective[`${r.key}:${a}`]).map((a) => ({ a: a as Action, g: p.effective[`${r.key}:${a}`] })),
    })).filter((x) => x.actions.length > 0),
  })).filter((x) => x.rows.length > 0);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Effective permissions" description={employee.isSuperAdmin ? "Super Admin: full access to every module." : `${Object.keys(p.effective).length} permissions across ${byModule.reduce((n, x) => n + x.rows.length, 0)} pages (as if the account were active).`}
          action={canManage && !employee.isSuperAdmin ? <LinkButton href={`/admin/users/${employee.id}/permissions`} size="sm"><KeyRound className="size-3.5" /> Manage page access</LinkButton> : undefined} />
        {employee.isSuperAdmin ? <p className="p-5 text-sm text-muted">Super Admin permissions cannot be restricted by individual overrides.</p> : byModule.length === 0 ? <p className="p-5 text-sm text-muted">No permissions. This employee cannot open any page except their dashboard and profile.</p> : (
          <div className="divide-y divide-line">
            {byModule.map(({ m, rows }) => (
              <div key={m.key} className="px-5 py-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{m.label}</h3>
                <ul className="mt-2 space-y-1.5">
                  {rows.map(({ r, actions }) => (
                    <li key={r.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                      <span className="w-52 font-medium text-ink">{r.label}</span>
                      <span className="flex flex-wrap gap-1">
                        {actions.map(({ a, g }) => (
                          <span key={a} title={g.individual && !g.viaRoles.length ? "Granted individually" : `Via ${g.viaRoles.join(", ")}`} className={cn("rounded px-1.5 py-0.5 text-xs", g.individual ? "bg-success-50 text-success-600" : "bg-brand-50 text-brand-700")}>
                            {ACTION_LABEL[a]}{g.scope === "assigned" ? " (assigned only)" : ""}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title="Explicit restrictions and individual grants" description="Overrides set for this employee only. A denial always beats role grants." />
        {p.overrides.length === 0 ? <p className="p-5 text-sm text-muted">No individual overrides.</p> : (
          <ul className="divide-y divide-line">
            {p.overrides.map((o) => (
              <li key={`${o.resource}:${o.action}`} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                <StatusBadge status={o.effect} label={o.effect === "deny" ? "Denied" : "Allowed"} tone={o.effect === "deny" ? "danger" : "success"} />
                <span className="font-medium text-ink">{RESOURCES.find((r) => r.key === o.resource)?.label ?? o.resource}: {ACTION_LABEL[o.action as Action] ?? o.action}</span>
                {o.scope === "assigned" && <span className="text-xs text-muted">assigned only</span>}
                <span className="ml-auto text-xs text-muted">{o.createdBy ?? "—"} · {formatDate(o.createdAt)}{o.reason ? ` · ${o.reason}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function DashboardTab({ employee, canView }: { employee: EmployeeDto; canView: boolean }) {
  const d = useApi<{ widgets: { key: string; enabled: boolean }[]; quickActions: string[]; available: { key: string; label: string }[]; availableQuick: { key: string; label: string }[]; customised: boolean }>(canView ? `/api/users/${employee.id}/dashboard` : null);
  if (!canView) return <Card><div className="p-6 text-sm text-muted">You do not have permission to view dashboard configuration.</div></Card>;
  const label = (k: string) => d.data?.available.find((a) => a.key === k)?.label ?? k;
  if (!d.data && !d.error) return <CardSkeleton lines={5} />;
  return (
    <Card>
      <CardHeader title="Dashboard" description={d.data?.customised ? "Custom layout." : "Using the default layout for this employee's permissions."} action={<LinkButton href={`/admin/users/${employee.id}/dashboard`} size="sm"><LayoutDashboard className="size-3.5" /> Configure dashboard</LinkButton>} />
      <div className="grid gap-6 p-5 sm:grid-cols-2">
        <div><h3 className="mb-2 text-sm font-semibold text-ink">Visible widgets</h3>{d.data?.widgets.filter((w) => w.enabled).length ? <ul className="space-y-1 text-sm">{d.data.widgets.filter((w) => w.enabled).map((w) => <li key={w.key}>{label(w.key)}</li>)}</ul> : <p className="text-sm text-muted">None</p>}</div>
        <div><h3 className="mb-2 text-sm font-semibold text-ink">Quick actions</h3>{d.data?.quickActions.length ? <ul className="space-y-1 text-sm">{d.data.quickActions.map((k) => <li key={k}>{d.data?.availableQuick.find((a) => a.key === k)?.label ?? k}</li>)}</ul> : <p className="text-sm text-muted">None</p>}</div>
      </div>
    </Card>
  );
}

function ActivityTab({ employee, canHistory, canActivity }: { employee: EmployeeDto; canHistory: boolean; canActivity: boolean }) {
  const history = useApi<{ items: HistoryItem[] }>(canHistory ? `/api/users/${employee.id}/history` : null);
  const activity = useApi<{ items: { id: string; action: string; entityType: string; entityLabel: string; detail: string | null; createdAt: string }[] }>(canActivity ? `/api/users/${employee.id}/activity` : null);
  const hist: TimelineEntry[] = (history.data?.items ?? []).map((h) => ({ id: h.id, title: describe(h), meta: `by ${h.actorName}`, at: h.createdAt, tone: h.kind.includes("removed") ? "warn" : "info" }));
  const act: TimelineEntry[] = (activity.data?.items ?? []).map((a) => ({ id: a.id, title: `${a.action.replace("_", " ")} ${a.entityType.toLowerCase()}: ${a.entityLabel}`, meta: a.detail ?? undefined, at: a.createdAt }));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader title="Access change history" description="Roles, permissions, status and dashboard changes for this employee." />{canHistory ? (!history.data && !history.error ? <ListSkeleton /> : <ActivityTimeline entries={hist} empty="No access changes recorded." />) : <p className="p-5 text-sm text-muted">You do not have permission to view this.</p>}</Card>
      <Card><CardHeader title="Recent activity" description="What this employee did in the admin." />{canActivity ? (!activity.data && !activity.error ? <ListSkeleton /> : <ActivityTimeline entries={act} empty="No activity yet." />) : <p className="p-5 text-sm text-muted">You do not have permission to view this.</p>}</Card>
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */

export function EmployeeDetail({ id }: { id: string }) {
  const search = useSearchParams();
  const { user, can } = useAuth();
  const confirm = useConfirm();
  const e = useApi<EmployeeDto>(`/api/users/${id}`);
  const tab = (TABS.find((t) => t.key === search.get("tab"))?.key ?? "profile") as TabKey;
  const [invite, setInvite] = useState<InviteResult | null>(null);
  useBreadcrumbLabel(e.data?.name);

  if (e.error?.status === 404) return <NotFoundRecord what="Employee" backHref="/admin/users" backLabel="Back to employees" />;
  if (e.error) return <ErrorState title="Couldn't load employee" description={e.error.message} onRetry={() => void e.reload()} />;
  if (!e.data) return <><PageHeader title="Employee" /><DetailSkeleton /></>;
  const emp = e.data;
  const self = emp.id === user?.id;

  const setStatus = async (status: "active" | "suspended") => {
    if (!(await confirm({ title: status === "suspended" ? `Deactivate ${emp.name}?` : `Activate ${emp.name}?`, description: status === "suspended" ? "They will be signed out immediately and cannot sign in until reactivated." : "They will be able to sign in again.", confirmLabel: status === "suspended" ? "Deactivate" : "Activate", destructive: status === "suspended" }))) return;
    try { await apiFetch(`/api/users/${emp.id}/status`, { method: "POST", body: { status } }); toast.success(status === "suspended" ? "Employee deactivated" : "Employee activated"); void e.reload(); } catch (err) { toast.error(errMsg(err)); }
  };
  const sendLink = async () => {
    try { setInvite(await apiFetch<InviteResult>(`/api/users/${emp.id}/invite`, { method: "POST", body: {} })); } catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <>
      <PageHeader
        title={emp.name}
        description={`${emp.employeeId}${emp.designation ? ` · ${emp.designation}` : ""}${emp.department ? ` · ${emp.department}` : ""}`}
        actions={
          <>
            {can("users", "edit") && <LinkButton href={`/admin/users/${emp.id}/edit`} variant="secondary"><Pencil className="size-4" /> Edit</LinkButton>}
            {can("user_permissions", "view") && <LinkButton href={`/admin/users/${emp.id}/permissions`} variant="secondary"><KeyRound className="size-4" /> Manage permissions</LinkButton>}
            {can("user_dashboards", "view") && <LinkButton href={`/admin/users/${emp.id}/dashboard`} variant="secondary"><LayoutDashboard className="size-4" /> Configure dashboard</LinkButton>}
            {can("users", "edit") && !self && emp.status !== "suspended" && <Button variant="secondary" onClick={() => sendLink()}><Mail className="size-4" /> {emp.status === "invited" ? "Send invitation" : "Send reset link"}</Button>}
            {can("users", "change_status") && !self && (emp.status === "suspended"
              ? <Button onClick={() => setStatus("active")}><UserCheck className="size-4" /> Activate</Button>
              : <Button variant="danger" onClick={() => setStatus("suspended")}><UserX className="size-4" /> Deactivate</Button>)}
          </>
        }
      />
      <div role="tablist" aria-label="Employee sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link key={t.key} role="tab" aria-selected={tab === t.key} href={`/admin/users/${emp.id}?tab=${t.key}`} replace scroll={false}
            className={cn("whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium", tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-ink")}>
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "profile" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Profile" />
            <div className="flex items-center gap-4 border-b border-line p-5"><Avatar name={emp.name} className="size-14 text-lg" /><div><p className="font-semibold text-ink">{emp.name}</p><p className="text-sm text-muted">{emp.email}</p></div><div className="ml-auto"><EmployeeStatus status={emp.status} /></div></div>
            <div className="p-5">
              <DetailList items={[
                { label: "Employee ID", value: <span className="font-mono text-xs">{emp.employeeId}</span> },
                { label: "Phone", value: emp.phone }, { label: "Department", value: emp.department }, { label: "Designation", value: emp.designation },
                { label: "Reporting manager", value: emp.reportingManager ? <Link href={`/admin/users/${emp.reportingManager.id}`} className="text-brand-600 hover:underline">{emp.reportingManager.name}</Link> : null },
                { label: "Last login", value: formatDate(emp.lastLoginAt, true) }, { label: "Created", value: formatDate(emp.createdAt, true) },
                { label: "Deactivated", value: emp.deactivatedAt ? formatDate(emp.deactivatedAt, true) : null },
              ]} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Access summary" />
            <div className="space-y-3 p-5 text-sm">
              <div><p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Roles</p><RoleChips roles={emp.roles} max={10} /></div>
              <div><p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Pages with access</p><p className="text-ink">{emp.isSuperAdmin ? "All pages (Super Admin)" : emp.assignedPageCount}</p></div>
            </div>
          </Card>
        </div>
      )}
      {tab === "roles" && <RolesTab employee={emp} canAssign={can("users", "assign") && !self} onSaved={() => void e.reload()} />}
      {tab === "permissions" && <PermissionsTab employee={emp} canView={can("user_permissions", "view")} canManage={can("user_permissions", "manage_permissions") && !self} />}
      {tab === "dashboard" && <DashboardTab employee={emp} canView={can("user_dashboards", "view")} />}
      {tab === "activity" && <ActivityTab employee={emp} canHistory={can("user_permissions", "view")} canActivity={can("activity_logs", "view")} />}
      <InviteLinkDialog result={invite} who={emp.email} onClose={() => setInvite(null)} />
    </>
  );
}
