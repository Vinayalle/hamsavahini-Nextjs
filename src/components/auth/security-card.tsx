"use client";

import { useState } from "react";
import { KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ApiClientError, apiFetch, isApiMode } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { useAuth } from "@/lib/auth";
import { MfaEnrollment, RecoveryCodes } from "./mfa";

interface MfaStatus {
  enabled: boolean;
  required: boolean;
  recoveryCodesRemaining: number;
}

/** Two-factor authentication status and self-service actions (profile page). Sensitive actions trigger the re-authentication prompt. */
export function SecurityCard() {
  const { refresh } = useAuth();
  const status = useApi<MfaStatus>("/api/auth/mfa");
  const [dialog, setDialog] = useState<"enroll" | "codes" | "disable" | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  if (!isApiMode || !status.data) return null;
  const s = status.data;

  const reload = async () => {
    await Promise.all([status.reload(), refresh()]);
  };
  const regenerate = async () => {
    setBusy(true);
    try {
      const r = await apiFetch<{ recoveryCodes: string[] }>("/api/auth/mfa/recovery-codes", { method: "POST", body: {} });
      setCodes(r.recoveryCodes);
      setDialog("codes");
      await reload();
    } catch (e) {
      if (!(e instanceof ApiClientError && e.code === "reauth_required")) toast.error(e instanceof ApiClientError ? e.message : "Could not create recovery codes");
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    setBusy(true);
    try {
      await apiFetch("/api/auth/mfa", { method: "DELETE" });
      setDialog(null);
      toast.success("Two-factor authentication turned off");
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Could not turn it off");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader title="Two-factor authentication" description="A second step at sign-in protects your account if your password is ever exposed." />
        <div className="space-y-4 p-5">
          <p className="flex items-center gap-2 text-sm text-ink">
            {s.enabled ? <ShieldCheck className="size-5 text-success-600" aria-hidden /> : <ShieldOff className="size-5 text-muted" aria-hidden />}
            {s.enabled ? "On" : "Off"}{s.required ? " · required for your role" : ""}
            {s.enabled && <span className="text-muted">· {s.recoveryCodesRemaining} recovery codes left</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {!s.enabled && <Button onClick={() => setDialog("enroll")}><KeyRound className="size-4" /> Turn on</Button>}
            {s.enabled && <Button variant="secondary" loading={busy} onClick={() => void regenerate()}>New recovery codes</Button>}
            {s.enabled && !s.required && <Button variant="secondary" onClick={() => setDialog("disable")}>Turn off</Button>}
          </div>
          {s.enabled && s.required && <p className="text-xs text-muted">Your role requires two-factor authentication, so you cannot turn it off. If you lose your device, a Super Admin can reset it.</p>}
        </div>
      </Card>

      <Dialog open={dialog === "enroll"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-6" aria-describedby="mfa-enroll-desc">
          <DialogTitle>Turn on two-factor authentication</DialogTitle>
          <DialogDescription id="mfa-enroll-desc">Use an authenticator app on your phone.</DialogDescription>
          <MfaEnrollment onEnrolled={async (c) => { setCodes(c); setDialog("codes"); await reload(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "codes"} onOpenChange={() => { /* must be acknowledged with the button */ }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-6" aria-describedby="mfa-codes-desc">
          <DialogTitle>Your recovery codes</DialogTitle>
          <DialogDescription id="mfa-codes-desc">Any previous recovery codes no longer work.</DialogDescription>
          <RecoveryCodes codes={codes} onDone={() => { setCodes([]); setDialog(null); }} doneLabel="Done" />
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "disable"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="p-6" aria-describedby="mfa-off-desc">
          <DialogTitle>Turn off two-factor authentication?</DialogTitle>
          <DialogDescription id="mfa-off-desc">Your account will be protected by your password alone. You can turn it on again at any time.</DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="danger" loading={busy} onClick={() => void disable()}>Turn off</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
