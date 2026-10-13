"use client";

import { useState } from "react";
import { LuLock as Lock, LuPlus as Plus, LuShieldCheck as ShieldCheck, LuTrash2 as Trash2 } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/fields";
import { PageHeader } from "@/components/admin/page-parts";
import { useConfirm, useUnsavedChangesGuard } from "@/components/admin/dialogs";
import { EntityFormDialog } from "@/components/forms/entity-form";
import { useAll } from "@/hooks/use-resource";
import { roleService, userService } from "@/lib/services";
import { cn } from "@/lib/utils";
import {
  PERMISSION_ACTIONS, PERMISSION_MODULES, type PermissionAction, type PermissionMatrix, type PermissionModule, type Role,
} from "@/types/entities";

const MODULE_LABEL: Record<PermissionModule, string> = {
  products: "Products", categories: "Categories", posts: "Posts / Insights", projects: "Projects", careers: "Careers",
  locations: "Locations", banners: "Banners & Homepage", commodities: "Commodities & Prices", trade: "Opportunities & RFQs",
  enquiries: "Contact Enquiries", applications: "Job Applications", media: "Media & Documents", users: "Admin Users & Roles", settings: "Website Settings",
};

function RoleMatrix({ role }: { role: Role }) {
  const confirm = useConfirm();
  const users = useAll(userService);
  const [draft, setDraft] = useState<PermissionMatrix>(role.permissions);
  const dirty = JSON.stringify(draft) !== JSON.stringify(role.permissions);
  const { dialog } = useUnsavedChangesGuard(dirty);
  const locked = role.isSystem;
  const assigned = users.filter((u) => u.roleId === role.id).length;

  const toggle = (m: PermissionModule, a: PermissionAction) => {
    setDraft((d) => {
      const has = d[m].includes(a);
      let next = has ? d[m].filter((x) => x !== a) : [...d[m], a];
      // Anything beyond "view" implies the ability to view; removing view removes everything.
      if (!has && a !== "view" && !next.includes("view")) next = ["view", ...next];
      if (has && a === "view") next = [];
      return { ...d, [m]: next };
    });
  };

  const save = async () => {
    if (!(await confirm({ title: "Save permission changes?", description: `${assigned} user${assigned === 1 ? "" : "s"} with the “${role.name}” role will be affected the next time they sign in.`, confirmLabel: "Save permissions" }))) return;
    await roleService.update(role.id, { permissions: draft });
    toast.success("Permissions updated", { description: "Mock data. The backend must enforce these on every request." });
  };

  const remove = async () => {
    if (assigned > 0) return void toast.error("Cannot delete role", { description: `${assigned} user(s) are still assigned to it.` });
    if (!(await confirm({ title: "Delete role?", description: `“${role.name}” will be permanently deleted.`, confirmLabel: "Delete", destructive: true }))) return;
    await roleService.remove(role.id);
    toast.success("Role deleted");
  };

  return (
    <Card>
      <CardHeader
        title={role.name}
        description={role.description}
        action={locked ? <span className="inline-flex items-center gap-1 text-xs text-muted"><Lock className="size-3.5" /> System role — read only</span> : (
          <Button variant="ghost" size="sm" onClick={() => remove()}><Trash2 className="size-3.5 text-danger-600" /> Delete</Button>
        )}
      />
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Permission matrix for {role.name}</caption>
          <thead>
            <tr className="border-b border-line bg-canvas/60 text-xs font-medium uppercase tracking-wide text-muted">
              <th scope="col" className="px-5 py-2.5 text-left">Module</th>
              {PERMISSION_ACTIONS.map((a) => <th key={a} scope="col" className="px-3 py-2.5 text-center">{a}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {PERMISSION_MODULES.map((m) => (
              <tr key={m} className="hover:bg-canvas/50">
                <th scope="row" className="px-5 py-2.5 text-left font-medium text-ink">{MODULE_LABEL[m]}</th>
                {PERMISSION_ACTIONS.map((a) => (
                  <td key={a} className="px-3 py-2.5 text-center">
                    <Checkbox
                      aria-label={`${role.name}: ${a} ${MODULE_LABEL[m]}`}
                      checked={draft[m].includes(a)} disabled={locked}
                      onChange={() => toggle(m, a)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!locked && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          <p className="text-xs text-muted">Permissions here describe intent. Real enforcement happens on the backend API.</p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={!dirty} onClick={() => setDraft(role.permissions)}>Reset</Button>
            <Button disabled={!dirty} onClick={() => save()}>Save permissions</Button>
          </div>
        </div>
      )}
      {dialog}
    </Card>
  );
}

export function MockRolesPage() {
  const roles = useAll(roleService);
  const users = useAll(userService);
  const [selectedId, setSelectedId] = useState<string>(roles[0]?.id ?? "");
  const [adding, setAdding] = useState(false);
  const role = roles.find((r) => r.id === selectedId) ?? roles[0];

  const emptyMatrix = () => Object.fromEntries(PERMISSION_MODULES.map((m) => [m, [] as PermissionAction[]])) as PermissionMatrix;

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description="Define what each role can view and change."
        actions={<Button onClick={() => setAdding(true)}><Plus className="size-4" /> New role</Button>}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="h-fit">
          <ul className="p-2" aria-label="Roles">
            {roles.map((r) => (
              <li key={r.id}>
                <button
                  type="button" onClick={() => setSelectedId(r.id)} aria-current={r.id === role?.id}
                  className={cn("flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-canvas", r.id === role?.id && "bg-brand-50")}
                >
                  <ShieldCheck className={cn("mt-0.5 size-4 shrink-0", r.id === role?.id ? "text-brand-600" : "text-faint")} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{r.name}</span>
                    <span className="block text-xs text-muted">{users.filter((u) => u.roleId === r.id).length} user(s)</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        {role && <RoleMatrix key={role.id} role={role} />}
      </div>

      <EntityFormDialog
        open={adding} onOpenChange={setAdding} title="New role" description="Starts with no permissions. Grant access in the matrix afterwards."
        sections={[{ title: "Role", fields: [
          { name: "name", label: "Role name", type: "text", required: true, maxLength: 40 },
          { name: "description", label: "Description", type: "textarea", required: true, minLength: 10, rows: 2 },
        ] }]}
        defaultValues={{ name: "", description: "" }}
        validate={(v) => roles.some((r) => r.name.toLowerCase() === String(v.name).toLowerCase()) ? { name: "A role with this name already exists" } : null}
        submitLabel="Create role"
        onSubmit={async (v) => {
          const created = await roleService.create({ name: String(v.name), description: String(v.description), isSystem: false, permissions: emptyMatrix() });
          setSelectedId(created.id);
          setAdding(false);
          toast.success("Role created");
        }}
      />
    </>
  );
}
