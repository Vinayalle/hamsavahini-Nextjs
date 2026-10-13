"use client";

import { useEffect, useState } from "react";
import { LuCopy as Copy, LuDatabaseZap as DatabaseZap } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/fields";
import { isApiMode } from "@/lib/api/client";
import { cn, initials } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-parts";
import { StatusBadge } from "@/components/admin/status-badge";
import { STATUS_LABEL, type EmployeeDto, type InviteResult, type RoleRef } from "./types";

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-bark-800 text-xs font-semibold text-white", className)} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function EmployeeStatus({ status }: { status: EmployeeDto["status"] }) {
  return <StatusBadge status={status} label={STATUS_LABEL[status]} />;
}

export function RoleChips({ roles, max = 3 }: { roles: RoleRef[]; max?: number }) {
  if (roles.length === 0) return <span className="text-xs text-faint">No role</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {roles.slice(0, max).map((r) => (
        <span key={r.id} className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", r.status === "inactive" ? "bg-slate-100 text-slate-500 line-through" : r.code === "super_admin" ? "bg-bark-800 text-white" : "bg-brand-50 text-brand-700")}>
          {r.name}
        </span>
      ))}
      {roles.length > max && <span className="rounded bg-canvas px-1.5 py-0.5 text-[11px] text-muted">+{roles.length - max}</span>}
    </div>
  );
}

/** Shown in mock mode for screens that only exist with the database backend. */
export function ApiModeOnly({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><DatabaseZap className="size-6" aria-hidden /></span>
          <h2 className="mt-4 text-[15px] font-semibold text-ink">Requires database mode</h2>
          <p className="mt-1 max-w-md text-sm text-muted">
            This screen manages real accounts and permissions, so it is only available when the app runs with the PostgreSQL backend
            (<code className="text-xs">NEXT_PUBLIC_DATA_SOURCE=api</code>). See README.md.
          </p>
        </div>
      </Card>
    </>
  );
}

export function useApiModeGate() {
  return isApiMode;
}

/** Shows the one-time invitation / reset link when email could not be delivered. */
export function InviteLinkDialog({ result, onClose, who }: { result: InviteResult | null; onClose: () => void; who: string }) {
  return (
    <Dialog open={!!result} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-6">
        <DialogTitle>{result?.deliveredByEmail ? "Link emailed" : "Share this link securely"}</DialogTitle>
        <DialogDescription>
          {result?.deliveredByEmail
            ? `An email with a single-use link was sent to ${who}.`
            : `Email delivery is not configured, so nothing was sent to ${who}. Give them this single-use link yourself. It is shown only once and expires ${result ? new Date(result.expiresAt).toLocaleString() : ""}.`}
        </DialogDescription>
        {result?.inviteUrl && (
          <div className="mt-4 space-y-2">
            <Input readOnly value={result.inviteUrl} aria-label="Single-use link" onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
            <Button variant="secondary" size="sm" onClick={() => { void navigator.clipboard?.writeText(result.inviteUrl!); toast.success("Link copied"); }}><Copy className="size-4" /> Copy link</Button>
          </div>
        )}
        <div className="mt-6 flex justify-end"><Button onClick={onClose}>Done</Button></div>
      </DialogContent>
    </Dialog>
  );
}
