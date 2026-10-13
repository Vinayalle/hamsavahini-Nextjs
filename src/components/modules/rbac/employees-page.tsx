"use client";

import { useState } from "react";
import Link from "next/link";
import { LuEye as Eye, LuHistory as History, LuKeyRound as KeyRound, LuLayoutDashboard as LayoutDashboard, LuMail as Mail, LuPencil as Pencil, LuShieldCheck as ShieldCheck, LuUserCheck as UserCheck, LuUserPlus as UserPlus, LuUserX as UserX, LuUsers as Users } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Label, Textarea } from "@/components/ui/fields";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DataTable, RowActions, type Column, type SortState } from "@/components/admin/data-table";
import { EmptyState, ErrorState, FilterBar, PageHeader, Pagination } from "@/components/admin/page-parts";
import { useConfirm } from "@/components/admin/dialogs";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Avatar, EmployeeStatus, InviteLinkDialog, RoleChips, useDebounced } from "./shared";
import type { EmployeeDto, EmployeeList, InviteResult, RoleDto } from "./types";
import { Skeleton } from "@/components/admin/skeletons";

const errMsg = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong");

function AssignRolesDialog({ employee, onClose, onSaved }: { employee: EmployeeDto | null; onClose: () => void; onSaved: () => void }) {
  const roles = useApi<{ items: RoleDto[] }>(employee ? "/api/roles" : null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [initFor, setInitFor] = useState<string | null>(null);
  if (employee && initFor !== employee.id) {
    setInitFor(employee.id);
    setSelected(employee.roles.map((r) => r.id));
  }
  const save = async () => {
    if (!employee) return;
    setSaving(true);
    try {
      await apiFetch(`/api/users/${employee.id}/roles`, { method: "PUT", body: { roleIds: selected } });
      toast.success(`Roles updated for ${employee.name}`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={!!employee} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md overflow-y-auto p-6">
        <DialogTitle>Assign roles</DialogTitle>
        <DialogDescription>{employee?.name}. Permissions from all selected roles are combined.</DialogDescription>
        <ul className="mt-4 max-h-80 space-y-1 overflow-y-auto" aria-label="Roles">
          {roles.loading && !roles.data && Array.from({ length: 4 }, (_, i) => <li key={i} className="px-2 py-1.5"><Skeleton className="h-12 w-full" /></li>)}
          {roles.data?.items.map((r) => (
            <li key={r.id}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-canvas">
                <Checkbox className="mt-0.5" checked={selected.includes(r.id)} disabled={r.status === "inactive"} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))} />
                <span><span className="block text-sm font-medium text-ink">{r.name}{r.status === "inactive" && <span className="ml-1 text-xs font-normal text-muted">(inactive)</span>}</span><span className="block text-xs text-muted">{r.description}</span></span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={() => save()}>Save roles</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeactivateDialog({ employee, onClose, onDone }: { employee: EmployeeDto | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const run = async () => {
    if (!employee) return;
    setSaving(true);
    try {
      await apiFetch(`/api/users/${employee.id}/status`, { method: "POST", body: { status: "suspended", reason: reason || undefined } });
      toast.success(`${employee.name} was deactivated`, { description: "Their sessions were ended immediately." });
      setReason("");
      onDone();
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={!!employee} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-6">
        <DialogTitle>Deactivate {employee?.name}?</DialogTitle>
        <DialogDescription>They will be signed out immediately and cannot sign in again until reactivated. Their history and records are kept.</DialogDescription>
        <div className="mt-4">
          <Label htmlFor="reason">Reason (optional, recorded in the audit log)</Label>
          <Textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={saving} onClick={() => run()}>Deactivate</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EmployeesPage() {
  const { user, can } = useAuth();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState>({ by: "createdAt", dir: "desc" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState<EmployeeDto | null>(null);
  const [deactivating, setDeactivating] = useState<EmployeeDto | null>(null);
  const [invite, setInvite] = useState<{ result: InviteResult; who: string } | null>(null);

  const params = new URLSearchParams({ page: String(page), pageSize: "10", sortBy: sort.by, sortDir: sort.dir });
  if (q) params.set("search", q);
  for (const [k, v] of Object.entries(filters)) if (v && v !== "all") params.set(k, v);
  const list = useApi<EmployeeList>(`/api/users?${params}`);
  const roles = useApi<{ items: RoleDto[] }>(can("roles", "view") ? "/api/roles" : null);

  const activate = async (e: EmployeeDto) => {
    if (!(await confirm({ title: `Activate ${e.name}?`, description: "They will be able to sign in again with their existing password.", confirmLabel: "Activate" }))) return;
    try { await apiFetch(`/api/users/${e.id}/status`, { method: "POST", body: { status: "active" } }); toast.success(`${e.name} is active`); void list.reload(); } catch (err) { toast.error(errMsg(err)); }
  };
  const sendLink = async (e: EmployeeDto) => {
    const reset = e.status === "active";
    if (!(await confirm({ title: reset ? "Send a password-reset link?" : "Send an invitation?", description: `A single-use link will be generated for ${e.name}.`, confirmLabel: "Send" }))) return;
    try { setInvite({ result: await apiFetch<InviteResult>(`/api/users/${e.id}/invite`, { method: "POST", body: {} }), who: e.email }); } catch (err) { toast.error(errMsg(err)); }
  };
  const bulk = async (status: "active" | "suspended") => {
    const ids = Array.from(selected).filter((id) => id !== user?.id);
    if (!(await confirm({ title: `${status === "suspended" ? "Deactivate" : "Activate"} ${ids.length} employee${ids.length > 1 ? "s" : ""}?`, description: status === "suspended" ? "They will be signed out immediately." : "Employees who never accepted their invitation cannot be activated.", confirmLabel: status === "suspended" ? "Deactivate" : "Activate", destructive: status === "suspended" }))) return;
    let ok = 0; const failed: string[] = [];
    for (const id of ids) { try { await apiFetch(`/api/users/${id}/status`, { method: "POST", body: { status } }); ok++; } catch (e) { failed.push(errMsg(e)); } }
    if (ok) toast.success(`${ok} updated`);
    if (failed.length) toast.error(`${failed.length} could not be changed`, { description: failed[0] });
    setSelected(new Set());
    void list.reload();
  };

  const columns: Column<EmployeeDto>[] = [
    { key: "id", header: "Employee ID", sortKey: "employeeId", hideBelow: "lg", cell: (e) => <span className="font-mono text-xs text-muted">{e.employeeId}</span> },
    { key: "name", header: "Name", sortKey: "name", cell: (e) => (
      <div className="flex items-center gap-3">
        <Avatar name={e.name} />
        <div className="min-w-0"><Link href={`/admin/users/${e.id}`} className="block truncate font-medium text-ink hover:text-brand-600">{e.name}{e.id === user?.id && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}</Link><span className="block truncate text-xs text-muted">{e.email}</span></div>
      </div>
    ) },
    { key: "dept", header: "Department", sortKey: "department", hideBelow: "lg", cell: (e) => e.department ?? <span className="text-faint">—</span> },
    { key: "roles", header: "Roles", hideBelow: "md", cell: (e) => <RoleChips roles={e.roles} /> },
    { key: "pages", header: "Pages", hideBelow: "md", cell: (e) => (e.isSuperAdmin ? <span className="text-xs text-muted">All</span> : e.assignedPageCount) },
    { key: "status", header: "Status", sortKey: "status", cell: (e) => <EmployeeStatus status={e.status} /> },
    { key: "last", header: "Last login", sortKey: "lastLoginAt", hideBelow: "lg", cell: (e) => <span className="text-muted">{formatDate(e.lastLoginAt, true)}</span> },
    { key: "created", header: "Created", sortKey: "createdAt", hideBelow: "lg", cell: (e) => <span className="text-muted">{formatDate(e.createdAt)}</span> },
  ];

  const add = can("users", "create") ? <LinkButton href="/admin/users/new"><UserPlus className="size-4" /> Add employee</LinkButton> : undefined;
  const filtering = !!q || Object.values(filters).some((v) => v && v !== "all");

  return (
    <>
      <PageHeader title="Admin Users" description="Employee accounts, their roles and the pages they can access." actions={add} />
      <Card className="overflow-hidden">
        <FilterBar
          search={search} onSearch={(v) => { setSearch(v); setPage(1); }} searchPlaceholder="Search name, employee ID or email…"
          filters={[
            { key: "department", label: "Department", options: (list.data?.departments ?? []).map((d) => ({ value: d, label: d })) },
            { key: "roleId", label: "Role", options: (roles.data?.items ?? []).map((r) => ({ value: r.id, label: r.name })) },
            { key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "invited", label: "Pending invitation" }, { value: "suspended", label: "Deactivated" }] },
            { key: "lastLogin", label: "Last login", options: [{ value: "7d", label: "Last 7 days" }, { value: "30d", label: "Last 30 days" }, { value: "never", label: "Never signed in" }] },
          ]}
          values={filters} onChange={(k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); }}
          onReset={() => { setSearch(""); setFilters({}); setPage(1); }}
        />
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-brand-50 px-4 py-2.5 text-sm" role="region" aria-label="Bulk actions">
            <span className="font-medium text-brand-700">{selected.size} selected</span>
            {can("users", "change_status") && <>
              <Button size="sm" variant="secondary" onClick={() => bulk("active")}><UserCheck className="size-3.5" /> Activate</Button>
              <Button size="sm" variant="danger" onClick={() => bulk("suspended")}><UserX className="size-3.5" /> Deactivate</Button>
            </>}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}
        {list.error ? <ErrorState title="Couldn't load employees" description={list.error.message} onRetry={() => void list.reload()} /> : (
          <DataTable
            caption="Employees" columns={columns} rows={list.data?.items ?? []} rowKey={(e) => e.id} loading={list.loading && !list.data}
            sort={sort} onSort={(s) => { setSort(s); setPage(1); }}
            selectable={can("users", "change_status")} selected={selected} onSelectedChange={setSelected}
            empty={<EmptyState icon={Users} title={filtering ? "No employees match your filters" : "No employees yet"} description={filtering ? "Try a different search or clear the filters." : "Add the first employee."} action={filtering ? <Button variant="secondary" onClick={() => { setSearch(""); setFilters({}); }}>Clear filters</Button> : add} />}
            rowActions={(e) => {
              const self = e.id === user?.id;
              return (
                <RowActions label={`Actions for ${e.name}`} items={[
                  { label: "View employee", icon: Eye, href: `/admin/users/${e.id}` },
                  { label: "Edit employee", icon: Pencil, href: `/admin/users/${e.id}/edit`, hidden: !can("users", "edit") },
                  { label: "Assign roles", icon: ShieldCheck, onSelect: () => setAssigning(e), hidden: !can("users", "assign") || self },
                  { label: "Manage page access", icon: KeyRound, href: `/admin/users/${e.id}/permissions`, hidden: !can("user_permissions", "view") },
                  { label: "Configure dashboard", icon: LayoutDashboard, href: `/admin/users/${e.id}/dashboard`, hidden: !can("user_dashboards", "view") },
                  { label: e.status === "invited" ? "Send invitation" : "Send password reset", icon: Mail, onSelect: () => sendLink(e), hidden: !can("users", "edit") || self || e.status === "suspended" },
                  { label: "View activity", icon: History, href: `/admin/users/${e.id}?tab=activity`, hidden: !can("activity_logs", "view") },
                  { label: "Activate", icon: UserCheck, onSelect: () => activate(e), hidden: !can("users", "change_status") || self || e.status !== "suspended", separatorBefore: true },
                  { label: "Deactivate", icon: UserX, destructive: true, onSelect: () => setDeactivating(e), hidden: !can("users", "change_status") || self || e.status === "suspended", separatorBefore: true },
                ]} />
              );
            }}
          />
        )}
        {list.data && list.data.total > 0 && <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} pageSize={list.data.pageSize} onPage={setPage} />}
      </Card>
      <AssignRolesDialog employee={assigning} onClose={() => setAssigning(null)} onSaved={() => void list.reload()} />
      <DeactivateDialog employee={deactivating} onClose={() => setDeactivating(null)} onDone={() => void list.reload()} />
      <InviteLinkDialog result={invite?.result ?? null} who={invite?.who ?? ""} onClose={() => setInvite(null)} />
    </>
  );
}
