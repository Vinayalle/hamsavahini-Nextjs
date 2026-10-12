"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/fields";
import { Field } from "@/components/forms/form-parts";
import { DetailList } from "@/components/admin/detail-parts";
import { ErrorState, PageHeader } from "@/components/admin/page-parts";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { passwordProblem } from "@/lib/authz/password-policy";
import { formatDate } from "@/lib/utils";
import { Avatar, EmployeeStatus, RoleChips } from "./shared";
import { NewPasswordFields, PasswordInput } from "@/components/auth/password-field";
import { SecurityCard } from "@/components/auth/security-card";
import { useAuth } from "@/lib/auth";
import type { EmployeeDto } from "./types";

export function ProfilePage() {
  const me = useApi<EmployeeDto>("/api/auth/profile");
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (me.error) return <ErrorState title="Couldn't load your profile" description={me.error.message} onRetry={() => void me.reload()} />;
  if (!me.data) return <PageHeader title="My Profile" description="Loading…" />;
  const e = me.data;
  const n = name ?? e.name;
  const p = phone ?? e.phone ?? "";
  const dirty = n !== e.name || p !== (e.phone ?? "");

  const save = async () => {
    const errs: Record<string, string> = {};
    if (n.trim().length < 2) errs.name = "Full name is required";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      me.set(await apiFetch<EmployeeDto>("/api/auth/profile", { method: "PATCH", body: { name: n.trim(), phone: p.trim() || null } }));
      setName(null); setPhone(null);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not save");
    } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="My Profile" description="Your account within the admin." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Profile details" description="You can change your name and phone. Other details are managed by an administrator." />
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="p-name" required error={errors.name}><Input id="p-name" value={n} aria-invalid={!!errors.name} onChange={(ev) => setName(ev.target.value)} /></Field>
              <Field label="Phone" htmlFor="p-phone"><Input id="p-phone" type="tel" value={p} onChange={(ev) => setPhone(ev.target.value)} /></Field>
              <Field label="Work email" htmlFor="p-email" hint="Changed by an administrator."><Input id="p-email" value={e.email} disabled /></Field>
              <Field label="Employee ID" htmlFor="p-id"><Input id="p-id" value={e.employeeId} disabled /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={!dirty} onClick={() => { setName(null); setPhone(null); setErrors({}); }}>Reset</Button>
              <Button disabled={!dirty} loading={saving} onClick={() => void save()}>Save profile</Button>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex flex-col items-center p-6 text-center">
            <Avatar name={e.name} className="size-16 text-xl" />
            <p className="mt-3 font-semibold text-ink">{e.name}</p>
            <p className="inline-flex items-center gap-1 text-sm text-muted"><ShieldCheck className="size-4 text-brand-600" aria-hidden /> {e.isSuperAdmin ? "Super Admin" : `${e.assignedPageCount} pages`}</p>
            <div className="mt-2"><EmployeeStatus status={e.status} /></div>
          </div>
          <div className="space-y-4 border-t border-line p-5">
            <div><p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Roles</p><RoleChips roles={e.roles} max={10} /></div>
            <DetailList items={[
              { label: "Department", value: e.department }, { label: "Designation", value: e.designation },
              { label: "Reports to", value: e.reportingManager?.name }, { label: "Last login", value: formatDate(e.lastLoginAt, true) },
            ]} />
          </div>
        </Card>
      </div>
      <div className="mt-6 max-w-xl"><SecurityCard /></div>
    </>
  );
}

export function ChangePasswordPage() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const ctx = { name: user?.name, email: user?.email, extraTerms: user?.employeeId ? [user.employeeId] : undefined };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const errs: Record<string, string> = {};
    if (!current) errs.current = "Enter your current password";
    const problem = passwordProblem(next, ctx);
    if (problem) errs.next = problem;
    if (next !== confirm) errs.confirm = "Passwords do not match";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await apiFetch("/api/auth/change-password", { method: "POST", body: { current, next } });
      setCurrent(""); setNext(""); setConfirm("");
      toast.success("Password changed", { description: "Your other sessions were signed out." });
    } catch (err) {
      if (err instanceof ApiClientError && err.fields) setErrors(err.fields);
      toast.error(err instanceof ApiClientError ? err.message : "Could not change password");
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Change Password" description="Choose a strong password you don't use anywhere else." />
      <form onSubmit={submit} noValidate className="max-w-xl">
        <Card>
          <CardHeader title="Update password" />
          <div className="space-y-4 p-5">
            <Field label="Current password" htmlFor="cp-current" required error={errors.current}>
              <PasswordInput id="cp-current" autoComplete="current-password" value={current} invalid={!!errors.current} onChange={setCurrent} />
            </Field>
            <NewPasswordFields password={next} confirm={confirm} onPassword={setNext} onConfirm={setConfirm} context={ctx} error={errors.next} confirmError={errors.confirm} idPrefix="cp" />
            <div className="flex justify-end pt-2"><Button type="submit" loading={busy}>Update password</Button></div>
          </div>
        </Card>
      </form>
    </>
  );
}
