"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/forms/form-parts";
import { ApiClientError, apiFetch, isApiMode, setReauthHandler } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { CodeInput } from "./otp";
import { ErrorNote } from "./auth-shell";
import { PasswordInput } from "./password-field";

/**
 * Step-up authentication prompt. When the server answers `reauth_required` for a sensitive operation (changing roles or
 * permissions, deactivating an employee, MFA changes ...), the API client opens this dialog, then repeats the request.
 */
export function ReauthDialog() {
  const { mfa } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    if (!isApiMode) return;
    setReauthHandler(() => new Promise<boolean>((resolve) => {
      resolver.current?.(false);
      resolver.current = resolve;
      setPassword(""); setCode(""); setError(""); setOpen(true);
    }));
    return () => setReauthHandler(null);
  }, []);

  const finish = (ok: boolean) => {
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return setError("Enter your password");
    if (mfa?.enabled && code.length !== 6) return setError("Enter the 6-digit code from your authenticator app");
    setBusy(true);
    try {
      await apiFetch("/api/auth/reauth", { method: "POST", body: { password, ...(mfa?.enabled ? { code } : {}) } });
      finish(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? (err.status === 429 ? "Too many attempts. Wait a few minutes." : err.message) : "Could not confirm. Try again.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  if (!isApiMode) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(false); }}>
      <DialogContent aria-describedby="reauth-desc">
        <form onSubmit={submit} className="space-y-4 p-6" noValidate>
          <div>
            <DialogTitle>Confirm it&apos;s you</DialogTitle>
            <DialogDescription id="reauth-desc">This action is sensitive. Re-enter your credentials to continue.</DialogDescription>
          </div>
          <Field label="Password" htmlFor="reauth-password" required>
            <PasswordInput id="reauth-password" value={password} onChange={(v) => { setPassword(v); setError(""); }} autoComplete="current-password" autoFocus />
          </Field>
          {mfa?.enabled && (
            <Field label="Authenticator code" htmlFor="reauth-code" required>
              <CodeInput id="reauth-code" value={code} onChange={(v) => { setCode(v); setError(""); }} />
            </Field>
          )}
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => finish(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Confirm</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
