"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Eye, Lock, Pencil, Plus, Power, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Input, Textarea } from "@/components/ui/fields";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DataTable, RowActions, type Column } from "@/components/admin/data-table";
import { EmptyState, ErrorState, FilterBar, NotFoundRecord, PageHeader } from "@/components/admin/page-parts";
import { StatusBadge } from "@/components/admin/status-badge";
import { useConfirm, useUnsavedChangesGuard } from "@/components/admin/dialogs";
import { Field, FormActions, FormSection } from "@/components/forms/form-parts";
import { useBreadcrumbLabel } from "@/components/admin/use-breadcrumb-label";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { useAuth } from "@/lib/auth";
import type { Scope } from "@/lib/authz/resolve";
import { formatDate } from "@/lib/utils";
import { PermissionTree, diffKeys, type Granted } from "./permission-tree";
import { EmployeeStatus } from "./shared";
import type { EmployeeList, RoleDetail, RoleDto } from "./types";

const errMsg = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong");

/* ───────────────────────── list ───────────────────────── */

function DuplicateDialog({ role, onClose, onDone }: { role: RoleDto | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const run = async () => {
    if (!role) return;
    if (name.trim().length < 2) return setError("Enter a name for the copy");
    setSaving(true);
    try {
      const copy = await apiFetch<RoleDetail>(`/api/roles/${role.id}/duplicate`, { method: "POST", body: { name: name.trim() } });
      toast.success(`Created “${copy.name}”`);
      setName(""); setError(""); onDone(); onClose();
      router.push(`/admin/roles/${copy.id}`);
    } catch (e) { setError(errMsg(e)); } finally { setSaving(false); }
  };
  return (
    <Dialog open={!!role} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-6">
        <DialogTitle>Duplicate role</DialogTitle>
        <DialogDescription>Copies all permissions of “{role?.name}” into a new, editable role.</DialogDescription>
        <div className="mt-4"><Field label="New role name" htmlFor="dup-name" required error={error}><Input id="dup-name" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} /></Field></div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={() => void run()}>Duplicate</Button></div>
      </DialogContent>
    </Dialog>
  );
}

function AssignEmployeesDialog({ role, onClose, onDone }: { role: RoleDto | null; onClose: () => void; onDone: () => void }) {
  const people = useApi<EmployeeList>(role ? "/api/users?pageSize=100&sortBy=name&sortDir=asc" : null);
  const [add, setAdd] = useState<string[]>([]);
  const [remove, setRemove] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const rows = (people.data?.items ?? []).filter((p) => `${p.name} ${p.employeeId}`.toLowerCase().includes(q.toLowerCase()));
  const has = (p: EmployeeList["items"][number]) => (p.roles.some((r) => r.id === role?.id) && !remove.includes(p.id)) || add.includes(p.id);
  const run = async () => {
    if (!role) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ results: { userId: string; ok: boolean; error?: string }[] }>(`/api/roles/${role.id}/employees`, { method: "PUT", body: { add, remove } });
      const bad = res.results.filter((r) => !r.ok);
      if (bad.length) toast.error(`${bad.length} could not be changed`, { description: bad[0].error });
      else toast.success("Assignments updated");
      setAdd([]); setRemove([]); onDone(); if (!bad.length) onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };
  return (
    <Dialog open={!!role} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg overflow-y-auto p-6">
        <DialogTitle>Assign employees to {role?.name}</DialogTitle>
        <DialogDescription>Each change is checked against your own authority and logged.</DialogDescription>
        <div className="mt-3"><Input placeholder="Search employees…" aria-label="Search employees" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {rows.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-canvas">
                <Checkbox checked={has(p)} onChange={(e) => {
                  const on = e.target.checked; const had = p.roles.some((r) => r.id === role?.id);
                  setAdd((a) => (on && !had ? [...a, p.id] : a.filter((x) => x !== p.id)));
                  setRemove((r) => (!on && had ? [...r, p.id] : r.filter((x) => x !== p.id)));
                }} />
                <span className="text-sm text-ink">{p.name} <span className="text-xs text-muted">{p.employeeId}</span></span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={add.length + remove.length === 0} loading={saving} onClick={() => void run()}>Save assignments</Button></div>
      </DialogContent>
    </Dialog>
  );
}

export function RolesListPage() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.system && filters.system !== "all") params.set("system", filters.system);
  const list = useApi<{ items: RoleDto[]; total: number }>(`/api/roles?${params}`);
  const [dup, setDup] = useState<RoleDto | null>(null);
  const [assign, setAssign] = useState<RoleDto | null>(null);

  const setStatus = async (r: RoleDto, status: "active" | "inactive") => {
    const impact = r.userCount ? ` ${r.userCount} employee${r.userCount > 1 ? "s" : ""} will ${status === "inactive" ? "lose" : "regain"} the permissions from this role immediately.` : "";
    if (!(await confirm({ title: `${status === "inactive" ? "Deactivate" : "Activate"} “${r.name}”?`, description: `${status === "inactive" ? "An inactive role grants nothing and cannot be assigned." : "The role will grant its permissions again."}${impact}`, confirmLabel: status === "inactive" ? "Deactivate" : "Activate", destructive: status === "inactive" }))) return;
    try { await apiFetch(`/api/roles/${r.id}/status`, { method: "POST", body: { status } }); toast.success(`Role ${status === "inactive" ? "deactivated" : "activated"}`); void list.reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async (r: RoleDto) => {
    if (!(await confirm({ title: `Delete “${r.name}”?`, description: r.userCount ? `${r.userCount} employee${r.userCount > 1 ? "s are" : " is"} still assigned to this role, so it cannot be deleted. Reassign them or deactivate the role instead.` : "This custom role will be permanently deleted. This cannot be undone.", confirmLabel: "Delete", destructive: true }))) return;
    try { await apiFetch(`/api/roles/${r.id}`, { method: "DELETE" }); toast.success("Role deleted"); void list.reload(); } catch (e) { toast.error(errMsg(e)); }
  };

  const columns: Column<RoleDto>[] = [
    { key: "name", header: "Role", cell: (r) => (
      <div className="min-w-0"><Link href={`/admin/roles/${r.id}`} className="block truncate font-medium text-ink hover:text-brand-600">{r.name}</Link><span className="block font-mono text-xs text-muted">{r.code}</span></div>
    ) },
    { key: "desc", header: "Description", hideBelow: "lg", cell: (r) => <span className="line-clamp-2 max-w-sm text-muted">{r.description}</span> },
    { key: "emps", header: "Employees", hideBelow: "sm", cell: (r) => r.userCount },
    { key: "perms", header: "Permissions", hideBelow: "md", cell: (r) => (r.readOnly ? "All" : r.permissionCount) },
    { key: "system", header: "Type", hideBelow: "md", cell: (r) => (r.isSystem ? <span className="inline-flex items-center gap-1 text-xs text-muted"><Lock className="size-3" /> System</span> : <span className="text-xs text-muted">Custom</span>) },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "updated", header: "Updated", hideBelow: "lg", cell: (r) => <span className="text-muted">{formatDate(r.updatedAt)}</span> },
  ];
  const add = can("roles", "create") ? <LinkButton href="/admin/roles/new"><Plus className="size-4" /> New role</LinkButton> : undefined;

  return (
    <>
      <PageHeader title="Roles & Permissions" description="Reusable sets of permissions. An employee can hold several roles; their permissions are combined." actions={add} />
      <Card className="overflow-hidden">
        <FilterBar search={search} onSearch={setSearch} searchPlaceholder="Search roles…" values={filters} onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} onReset={() => { setSearch(""); setFilters({}); }}
          filters={[{ key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] }, { key: "system", label: "Type", options: [{ value: "true", label: "System" }, { value: "false", label: "Custom" }] }]} />
        {list.error ? <ErrorState title="Couldn't load roles" description={list.error.message} onRetry={() => void list.reload()} /> : (
          <DataTable caption="Roles" columns={columns} rows={list.data?.items ?? []} rowKey={(r) => r.id} loading={list.loading && !list.data}
            empty={<EmptyState icon={ShieldCheck} title="No roles found" description="Try a different search or filter." action={add} />}
            rowActions={(r) => (
              <RowActions label={`Actions for ${r.name}`} items={[
                { label: "View permissions", icon: Eye, href: `/admin/roles/${r.id}` },
                { label: "Edit role", icon: Pencil, href: `/admin/roles/${r.id}/edit`, hidden: !can("roles", "edit") || r.readOnly },
                { label: "Duplicate role", icon: Copy, onSelect: () => setDup(r), hidden: !can("roles", "create") },
                { label: "Assign employees", icon: Users, onSelect: () => setAssign(r), hidden: !can("roles", "assign") },
                { label: r.status === "active" ? "Deactivate role" : "Activate role", icon: Power, onSelect: () => void setStatus(r, r.status === "active" ? "inactive" : "active"), hidden: !can("roles", "change_status") || r.readOnly, separatorBefore: true },
                { label: "Delete role", icon: Trash2, destructive: true, onSelect: () => void remove(r), hidden: !can("roles", "delete") || r.isSystem, separatorBefore: true },
              ]} />
            )}
          />
        )}
      </Card>
      <DuplicateDialog role={dup} onClose={() => setDup(null)} onDone={() => void list.reload()} />
      <AssignEmployeesDialog role={assign} onClose={() => setAssign(null)} onDone={() => void list.reload()} />
    </>
  );
}

/* ───────────────────────── detail ───────────────────────── */

export function RoleDetailPage({ id }: { id: string }) {
  const { can } = useAuth();
  const role = useApi<RoleDetail>(`/api/roles/${id}`);
  useBreadcrumbLabel(role.data?.name);
  if (role.error?.status === 404) return <NotFoundRecord what="Role" backHref="/admin/roles" backLabel="Back to roles" />;
  if (role.error) return <ErrorState title="Couldn't load role" description={role.error.message} onRetry={() => void role.reload()} />;
  if (!role.data) return <PageHeader title="Role" description="Loading…" />;
  const r = role.data;
  const granted: Granted = Object.fromEntries(r.grants.map((g) => [`${g.resource}:${g.action}`, g.scope]));
  return (
    <>
      <PageHeader title={r.name} description={r.description}
        actions={<>{can("roles", "edit") && !r.readOnly && <LinkButton href={`/admin/roles/${r.id}/edit`}><Pencil className="size-4" /> Edit role</LinkButton>}</>} />
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <StatusBadge status={r.status} />
        <span className="text-muted">{r.isSystem ? "System role" : "Custom role"} · code <code className="text-xs">{r.code}</code> · {r.userCount} employee{r.userCount === 1 ? "" : "s"}</span>
        {r.readOnly && <span className="inline-flex items-center gap-1 text-xs text-muted"><Lock className="size-3" /> Read only: Super Admin always has full access</span>}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {r.readOnly ? <Card><div className="p-6 text-sm text-muted">The Super Admin role holds every permission, including any added in future.</div></Card>
            : <PermissionTree mode="role" granted={granted} onGrantedChange={() => {}} delegable={r.delegable} readOnly />}
        </div>
        <Card className="h-fit">
          <CardHeader title={`Employees (${r.users.length})`} />
          {r.users.length === 0 ? <p className="p-5 text-sm text-muted">No employees have this role.</p> : (
            <ul className="divide-y divide-line">
              {r.users.map((u) => (
                <li key={u.id}><Link href={`/admin/users/${u.id}`} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm hover:bg-canvas/60"><span className="min-w-0 truncate font-medium text-ink">{u.name}<span className="ml-1.5 text-xs font-normal text-muted">{u.employeeId}</span></span><EmployeeStatus status={u.status as "active"} /></Link></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

/* ───────────────────────── create / edit ───────────────────────── */

export function RoleFormPage({ id }: { id?: string }) {
  const role = useApi<RoleDetail>(id ? `/api/roles/${id}` : null);
  const me = useApi<{ permissions: string[]; isSuperAdmin: boolean }>(id ? null : "/api/auth/me");
  useBreadcrumbLabel(role.data?.name);
  if (id && role.error?.status === 404) return <NotFoundRecord what="Role" backHref="/admin/roles" backLabel="Back to roles" />;
  if (id && role.error) return <ErrorState title="Couldn't load role" description={role.error.message} onRetry={() => void role.reload()} />;
  if (id && !role.data) return <PageHeader title="Edit role" description="Loading…" />;
  if (!id && !me.data) return <PageHeader title="New role" description="Loading…" />;
  const delegable: Record<string, Scope> = id ? role.data!.delegable : Object.fromEntries(me.data!.permissions.map((k) => [k, "all" as Scope]));
  return <RoleForm role={role.data} delegable={delegable} />;
}

function RoleForm({ role, delegable }: { role?: RoleDetail; delegable: Record<string, Scope> }) {
  const router = useRouter();
  const initial = useMemo<Granted>(() => Object.fromEntries((role?.grants ?? []).map((g) => [`${g.resource}:${g.action}`, g.scope])), [role]);
  const [name, setName] = useState(role?.name ?? "");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState(role?.description ?? "");
  const [granted, setGranted] = useState<Granted>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const dirty = name !== (role?.name ?? "") || description !== (role?.description ?? "") || code !== "" || JSON.stringify(granted) !== JSON.stringify(initial);
  const { navigate, dialog } = useUnsavedChangesGuard(dirty && !saving);
  const diff = diffKeys(initial, granted);

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Role name is required";
    if (description.trim().length < 5) e.description = "Add a short description";
    if (!role && code && !/^[a-z][a-z0-9_]{2,39}$/.test(code)) e.code = "Use 3-40 lowercase letters, numbers or underscores";
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const toGrants = () => Object.entries(granted).map(([k, scope]) => ({ resource: k.slice(0, k.lastIndexOf(":")), action: k.slice(k.lastIndexOf(":") + 1), scope }));

  const save = async () => {
    if (!validate()) return void toast.error("Please fix the highlighted fields before saving.");
    setSaving(true);
    try {
      if (role) {
        if (name !== role.name || description !== role.description) await apiFetch(`/api/roles/${role.id}`, { method: "PATCH", body: { name, description } });
        if (JSON.stringify(granted) !== JSON.stringify(initial)) await apiFetch(`/api/roles/${role.id}/permissions`, { method: "PUT", body: { grants: toGrants() } });
        toast.success("Role updated", { description: role.userCount ? `${role.userCount} employee(s) are affected immediately.` : undefined });
        router.push(`/admin/roles/${role.id}`);
      } else {
        const created = await apiFetch<RoleDetail>("/api/roles", { method: "POST", body: { name, code: code || undefined, description, grants: toGrants() } });
        toast.success("Role created");
        router.push(`/admin/roles/${created.id}`);
      }
    } catch (e) {
      if (e instanceof ApiClientError && e.fields) {
        const mapped: Record<string, string> = {};
        for (const k of ["name", "code", "description"]) if (e.fields[k]) mapped[k] = e.fields[k];
        if (Object.keys(mapped).length) setErrors(mapped);
      }
      toast.error(errMsg(e));
    } finally { setSaving(false); setReviewing(false); }
  };

  const needsReview = !!role && role.userCount > 0 && JSON.stringify(granted) !== JSON.stringify(initial);

  return (
    <>
      <PageHeader title={role ? `Edit ${role.name}` : "New Role"} description={role ? "Changes to permissions apply to every employee with this role immediately." : "Create a reusable set of permissions."} />
      <div className="space-y-6">
        <FormSection title="Role details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Role name" htmlFor="role-name" required error={errors.name}><Input id="role-name" value={name} aria-invalid={!!errors.name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Role code" htmlFor="role-code" error={errors.code} hint={role ? "Fixed after creation." : "Optional. Generated from the name if empty."}>
              <Input id="role-code" disabled={!!role} value={role ? role.code : code} placeholder="e.g. regional_editor" onChange={(e) => setCode(e.target.value.toLowerCase())} />
            </Field>
            <Field label="Description" htmlFor="role-desc" required error={errors.description} className="sm:col-span-2"><Textarea id="role-desc" rows={2} value={description} aria-invalid={!!errors.description} onChange={(e) => setDescription(e.target.value)} /></Field>
          </div>
        </FormSection>
        <FormSection title="Permissions" description="Choose the pages and actions this role grants. You can only grant permissions that you hold yourself.">
          <PermissionTree mode="role" granted={granted} onGrantedChange={setGranted} delegable={delegable} />
        </FormSection>
        <FormActions>
          <Button variant="secondary" onClick={() => navigate(role ? `/admin/roles/${role.id}` : "/admin/roles")}>Cancel</Button>
          <Button loading={saving} onClick={() => (needsReview ? (validate() && setReviewing(true)) : void save())}>{role ? "Save changes" : "Create role"}</Button>
        </FormActions>
        {dialog}
      </div>
      <Dialog open={reviewing} onOpenChange={setReviewing}>
        <DialogContent className="max-w-md p-6">
          <DialogTitle>Apply permission changes?</DialogTitle>
          <DialogDescription>{role?.userCount} employee{role?.userCount === 1 ? "" : "s"} with this role will be affected immediately: {diff.added.length} permission(s) added, {diff.removed.length} removed{diff.scoped.length ? `, ${diff.scoped.length} scope change(s)` : ""}.</DialogDescription>
          <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setReviewing(false)}>Keep editing</Button><Button variant={diff.removed.length ? "danger" : "primary"} loading={saving} onClick={() => void save()}>Apply changes</Button></div>
        </DialogContent>
      </Dialog>
    </>
  );
}
