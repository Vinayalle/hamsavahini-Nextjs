"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/fields";
import { Field, FormActions, FormSection } from "@/components/forms/form-parts";
import { NotFoundRecord, PageHeader } from "@/components/admin/page-parts";
import { useUnsavedChangesGuard } from "@/components/admin/dialogs";
import { useBreadcrumbLabel } from "@/components/admin/use-breadcrumb-label";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { useAuth } from "@/lib/auth";
import { InviteLinkDialog } from "./shared";
import type { EmployeeDto, EmployeeList, InviteResult, RoleDto } from "./types";
import { FormSkeleton } from "@/components/admin/skeletons";

const schema = z.object({
  name: z.string().trim().min(2, "Full name is required").max(120),
  email: z.string().trim().min(1, "Work email is required").email("Enter a valid email"),
  employeeId: z.string().trim().max(20).regex(/^([A-Za-z0-9-]{3,20})?$/, "Use 3-20 letters, numbers or hyphens"),
  phone: z.string().trim().max(30),
  department: z.string().trim().max(80),
  designation: z.string().trim().max(80),
  reportingManagerId: z.string(),
  roleIds: z.array(z.string()),
});
type Values = z.infer<typeof schema>;

export function EmployeeForm({ id }: { id?: string }) {
  const router = useRouter();
  const { can } = useAuth();
  const existing = useApi<EmployeeDto>(id ? `/api/users/${id}` : null);
  const roles = useApi<{ items: RoleDto[] }>(can("roles", "view") || can("users", "assign") ? "/api/roles" : null);
  const people = useApi<EmployeeList>("/api/users?pageSize=100&sortBy=name&sortDir=asc");
  useBreadcrumbLabel(existing.data?.name);

  if (id && existing.error?.status === 404) return <NotFoundRecord what="Employee" backHref="/admin/users" backLabel="Back to employees" />;
  if (id && !existing.data) return <><PageHeader title="Edit employee" /><FormSkeleton /></>;
  return <FormBody employee={existing.data} roles={roles.data?.items ?? []} people={(people.data?.items ?? []).filter((p) => p.id !== id)} canAssign={can("users", "assign")} router={router} />;
}

function FormBody({ employee, roles, people, canAssign, router }: { employee?: EmployeeDto; roles: RoleDto[]; people: EmployeeDto[]; canAssign: boolean; router: ReturnType<typeof useRouter> }) {
  const [invite, setInvite] = useState<{ result: InviteResult; who: string; goTo: string } | null>(null);
  const { register, handleSubmit, setValue, control, setError, reset, formState: { errors, isDirty, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: employee?.name ?? "", email: employee?.email ?? "", employeeId: employee?.employeeId ?? "", phone: employee?.phone ?? "",
      department: employee?.department ?? "", designation: employee?.designation ?? "", reportingManagerId: employee?.reportingManager?.id ?? "", roleIds: [],
    },
  });
  const { navigate, dialog } = useUnsavedChangesGuard(isDirty && !isSubmitting);
  const roleIds = useWatch({ control, name: "roleIds" });

  const onSubmit = async (v: Values) => {
    try {
      if (employee) {
        await apiFetch(`/api/users/${employee.id}`, { method: "PATCH", body: { name: v.name, email: v.email, phone: v.phone || null, department: v.department || null, designation: v.designation || null, reportingManagerId: v.reportingManagerId || null } });
        toast.success("Employee updated");
        reset(v);
        router.push(`/admin/users/${employee.id}`);
      } else {
        const res = await apiFetch<{ employee: EmployeeDto; invite: InviteResult }>("/api/users", {
          method: "POST",
          body: { name: v.name, email: v.email, employeeId: v.employeeId || undefined, phone: v.phone || null, department: v.department || null, designation: v.designation || null, reportingManagerId: v.reportingManagerId || null, roleIds: v.roleIds },
        });
        toast.success(`${res.employee.name} was added`, { description: "Status: pending invitation." });
        reset(v);
        setInvite({ result: res.invite, who: res.employee.email, goTo: `/admin/users/${res.employee.id}` });
      }
    } catch (e) {
      if (e instanceof ApiClientError && e.fields) {
        let mapped = false;
        for (const k of ["name", "email", "employeeId", "phone", "department", "designation", "reportingManagerId"] as const) if (e.fields[k]) { setError(k, { message: e.fields[k] }); mapped = true; }
        if (mapped) return void toast.error("Please fix the highlighted fields before saving.");
      }
      toast.error(e instanceof ApiClientError ? e.message : "Could not save the employee");
    }
  };

  return (
    <>
      <PageHeader title={employee ? `Edit ${employee.name}` : "Add Employee"} description={employee ? `${employee.employeeId}` : "They are created as pending and receive a secure single-use invitation. There is no shared default password."} />
      <form onSubmit={handleSubmit(onSubmit, () => toast.error("Please fix the highlighted fields before saving."))} noValidate className="space-y-6">
        <FormSection title="Employee details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="name" required error={errors.name?.message}><Input id="name" aria-invalid={!!errors.name} {...register("name")} /></Field>
            <Field label="Work email" htmlFor="email" required error={errors.email?.message}><Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} /></Field>
            <Field label="Employee ID" htmlFor="employeeId" error={errors.employeeId?.message} hint={employee ? "Cannot be changed." : "Leave empty to generate the next number automatically."}>
              <Input id="employeeId" disabled={!!employee} placeholder="EMP-0012" aria-invalid={!!errors.employeeId} {...register("employeeId")} />
            </Field>
            <Field label="Phone" htmlFor="phone" error={errors.phone?.message}><Input id="phone" type="tel" {...register("phone")} /></Field>
            <Field label="Department" htmlFor="department" error={errors.department?.message}><Input id="department" placeholder="Trading, HR, Operations…" {...register("department")} /></Field>
            <Field label="Designation" htmlFor="designation" error={errors.designation?.message}><Input id="designation" {...register("designation")} /></Field>
            <Field label="Reporting manager" htmlFor="reportingManagerId" error={errors.reportingManagerId?.message} className="sm:col-span-2">
              <Select id="reportingManagerId" {...register("reportingManagerId")}>
                <option value="">None</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.employeeId})</option>)}
              </Select>
            </Field>
          </div>
        </FormSection>

        {!employee && (
          <FormSection title="Roles" description={canAssign ? "Choose one or more roles. Permissions from all selected roles are combined." : "You do not have permission to assign roles; the employee will be created without one."}>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Roles">
              {roles.map((r) => (
                <li key={r.id}>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line p-3 hover:bg-canvas">
                    <Checkbox className="mt-0.5" disabled={!canAssign || r.status === "inactive"} checked={roleIds.includes(r.id)} onChange={(e) => setValue("roleIds", e.target.checked ? [...roleIds, r.id] : roleIds.filter((x) => x !== r.id), { shouldDirty: true })} />
                    <span><span className="block text-sm font-medium text-ink">{r.name}</span><span className="block text-xs text-muted">{r.description}</span></span>
                  </label>
                </li>
              ))}
            </ul>
          </FormSection>
        )}

        <FormActions>
          <Button variant="secondary" onClick={() => navigate(employee ? `/admin/users/${employee.id}` : "/admin/users")}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{employee ? "Save changes" : "Create employee"}</Button>
        </FormActions>
        {dialog}
      </form>
      <InviteLinkDialog result={invite?.result ?? null} who={invite?.who ?? ""} onClose={() => { const go = invite?.goTo; setInvite(null); if (go) router.push(go); }} />
    </>
  );
}
