"use client";

import { useState } from "react";
import { LuPencil as Pencil, LuUserPlus as UserPlus } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import type { Column } from "@/components/admin/data-table";
import { EntityFormDialog, type SectionDef, type Values } from "@/components/forms/entity-form";
import { useAll } from "@/hooks/use-resource";
import { roleService, userService } from "@/lib/services";
import { formatDate, initials } from "@/lib/utils";
import type { AdminUser } from "@/types/entities";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const SELF_ID = "usr_001"; // the mock signed-in Super Admin

export function MockUsersPage() {
  const roles = useAll(roleService);
  const users = useAll(userService);
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const current = editing && editing !== "new" ? editing : undefined;
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "—";

  const sections: SectionDef[] = [{
    title: "User",
    fields: [
      { name: "name", label: "Full name", type: "text", required: true },
      { name: "email", label: "Work email", type: "email", required: true },
      { name: "roleId", label: "Role", type: "select", required: true, options: roles.map((r) => ({ value: r.id, label: r.name })) },
      ...(current ? [{ name: "status", label: "Status", type: "select" as const, required: true, options: [{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "invited", label: "Invited" }] }] : []),
    ],
  }];

  const columns: Column<AdminUser>[] = [
    { key: "name", header: "User", sortKey: "name", cell: (u) => (
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bark-800 text-xs font-semibold text-white">{initials(u.name)}</span>
        <div className="min-w-0"><span className="block truncate font-medium text-ink">{u.name}{u.id === SELF_ID && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}</span><span className="block truncate text-xs text-muted">{u.email}</span></div>
      </div>
    ) },
    { key: "role", header: "Role", hideBelow: "sm", cell: (u) => roleName(u.roleId) },
    { key: "2fa", header: "2FA", hideBelow: "lg", cell: (u) => (u.twoFactorEnabled ? "Enabled" : <span className="text-warn-600">Not set</span>) },
    { key: "status", header: "Status", sortKey: "status", cell: (u) => <StatusBadge status={u.status} /> },
    { key: "login", header: "Last login", sortKey: "lastLoginAt", hideBelow: "md", cell: (u) => <span className="text-muted">{formatDate(u.lastLoginAt, true)}</span> },
  ];

  const save = async (v: Values) => {
    if (current) {
      await userService.update(current.id, { name: str(v.name), email: str(v.email), roleId: str(v.roleId), status: str(v.status) as AdminUser["status"] });
      toast.success("User updated");
    } else {
      await userService.create({ name: str(v.name), email: str(v.email), roleId: str(v.roleId), status: "invited", lastLoginAt: null, twoFactorEnabled: false });
      toast.success("Invitation recorded", { description: "Mock only — no email is sent." });
    }
    setEditing(null);
  };

  const add = <Button onClick={() => setEditing("new")}><UserPlus className="size-4" /> Invite admin</Button>;
  const superRole = roles.find((r) => r.isSystem)?.id;

  return (
    <>
      <PageHeader title="Admin Users" description="People who can sign in to this admin. Access is determined by role." actions={add} />
      <ResourceList
        service={userService} entityLabel="user" nameOf={(u) => u.name} columns={columns}
        defaultSort={{ by: "name", dir: "asc" }} searchPlaceholder="Search name or email…" emptyAction={add}
        statuses={[{ value: "active" }, { value: "suspended" }]} currentStatus={(u) => u.status}
        extraRowActions={(u) => [{ label: "Edit", icon: Pencil, onSelect: () => setEditing(u) }]}
        deleteGuard={(u) => {
          if (u.id === SELF_ID) return "You cannot delete your own account.";
          if (u.roleId === superRole && users.filter((x) => x.roleId === superRole).length <= 1) return "At least one Super Admin must remain.";
          return null;
        }}
        filters={[
          { key: "roleId", label: "Role", options: roles.map((r) => ({ value: r.id, label: r.name })) },
          { key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "invited", label: "Invited" }, { value: "suspended", label: "Suspended" }] },
        ]}
      />
      <EntityFormDialog
        open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={current ? "Edit admin user" : "Invite admin user"}
        description={current ? undefined : "They will appear as Invited until they set up their account."}
        sections={sections}
        defaultValues={current ? { ...current } : { name: "", email: "", roleId: "" }}
        validate={(v) => {
          const out: Record<string, string> = {};
          if (users.some((u) => u.id !== current?.id && u.email.toLowerCase() === str(v.email).toLowerCase())) out.email = "An admin with this email already exists";
          if (current?.id === SELF_ID && v.status !== "active") out.status = "You cannot suspend your own account";
          return out;
        }}
        submitLabel={current ? "Save changes" : "Send invitation"} onSubmit={save}
      />
    </>
  );
}
