"use client";

import { useEffect, useState } from "react";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/fields";
import { Field } from "@/components/forms/form-parts";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { CodeInput, useCooldown } from "./otp";
import { ErrorNote } from "./auth-shell";

const message = (e: unknown, fallback: string) => (e instanceof ApiClientError ? (e.status === 429 ? "Too many attempts. Wait a few minutes and try again." : e.message) : fallback);

/** Second step of sign-in: authenticator code, or a recovery code. */
export function MfaChallenge({ onSubmit, onExpired }: { onSubmit: (input: { code?: string; recoveryCode?: string }) => Promise<void>; onExpired: () => void }) {
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!useRecovery && code.length !== 6) return setError("Enter the 6-digit code from your authenticator app");
    if (useRecovery && recovery.replace(/[\s-]/g, "").length !== 10) return setError("Enter one of your 10-character recovery codes");
    setBusy(true);
    try {
      await onSubmit(useRecovery ? { recoveryCode: recovery } : { code });
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "mfa_session_expired") return onExpired();
      setError(message(err, "Could not verify the code. Try again."));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      {useRecovery ? (
        <Field label="Recovery code" htmlFor="mfa-recovery" required hint="Each recovery code works once.">
          <Input id="mfa-recovery" value={recovery} autoFocus autoComplete="off" spellCheck={false} placeholder="XXXXX-XXXXX" className="font-mono uppercase tracking-wider" onChange={(e) => { setRecovery(e.target.value); setError(""); }} />
        </Field>
      ) : (
        <Field label="Authenticator code" htmlFor="mfa-code" required hint="Open your authenticator app and enter the current 6-digit code.">
          <CodeInput id="mfa-code" value={code} autoFocus onChange={(v) => { setCode(v); setError(""); }} />
        </Field>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" className="w-full justify-center" loading={busy}>Verify and sign in</Button>
      <button type="button" className="block w-full text-center text-sm font-medium text-brand-600 hover:underline" onClick={() => { setUseRecovery((u) => !u); setError(""); }}>
        {useRecovery ? "Use my authenticator app instead" : "Lost your device? Use a recovery code"}
      </button>
    </form>
  );
}

/** Second step of sign-in when codes are emailed: type the 6-digit code from the email; resend after the cooldown. */
export function EmailCodeChallenge({ maskedEmail, onSubmit, onExpired }: { maskedEmail?: string; onSubmit: (input: { code: string }) => Promise<void>; onExpired: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown();

  useEffect(() => { cooldown.start(60); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return setError("Enter the 6-digit code from your email");
    setBusy(true);
    try {
      await onSubmit({ code });
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "mfa_session_expired") return onExpired();
      setError(message(err, "Could not verify the code. Try again."));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(""); setNotice("");
    try {
      const r = await apiFetch<{ sent: boolean; retryAfterSeconds: number | null }>("/api/auth/mfa/resend", { method: "POST", body: {} });
      cooldown.start(r.retryAfterSeconds ?? 60);
      setNotice(r.sent ? "A new code was sent." : "A code was already sent a moment ago. Check your inbox (and spam).");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "mfa_session_expired") return onExpired();
      setError(message(err, "Could not send a new code."));
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      <p className="text-sm text-ink">We emailed a 6-digit sign-in code to <strong>{maskedEmail ?? "your email address"}</strong>. It expires in 5 minutes.</p>
      <Field label="Sign-in code" htmlFor="email-code" required>
        <CodeInput id="email-code" value={code} autoFocus onChange={(v) => { setCode(v); setError(""); }} />
      </Field>
      {notice && <p className="rounded-md bg-success-50 px-3 py-2 text-sm text-success-600" role="status">{notice}</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" className="w-full justify-center" loading={busy}>Verify and sign in</Button>
      <button type="button" className="block w-full text-center text-sm font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-faint disabled:no-underline" disabled={cooldown.left > 0} onClick={() => void resend()}>
        {cooldown.left > 0 ? `Resend code in ${cooldown.left}s` : "Didn't get it? Send a new code"}
      </button>
    </form>
  );
}

interface Enrollment {
  secret: string;
  qrDataUrl: string;
}

/** Scan the QR code (or type the key), then confirm with a first code. Calls `onEnrolled` with the one-time recovery codes. */
export function MfaEnrollment({ onEnrolled, onExpired }: { onEnrolled: (recoveryCodes: string[]) => void | Promise<void>; onExpired?: () => void }) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Enrollment>("/api/auth/mfa/enroll/start", { method: "POST", body: {} })
      .then((r) => !cancelled && setEnrollment(r))
      .catch((err) => {
        if (err instanceof ApiClientError && err.code === "mfa_session_expired") return onExpired?.();
        if (!cancelled) setError(message(err, "Could not start setup. Try again."));
      });
    return () => { cancelled = true; };
  }, [onExpired]);

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return setError("Enter the 6-digit code shown in your app");
    setBusy(true);
    try {
      const r = await apiFetch<{ recoveryCodes: string[] }>("/api/auth/mfa/enroll/confirm", { method: "POST", body: { code } });
      await onEnrolled(r.recoveryCodes);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "mfa_session_expired") return onExpired?.();
      setError(message(err, "Could not confirm the code."));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const grouped = enrollment?.secret.replace(/(.{4})/g, "$1 ").trim();
  return (
    <form onSubmit={confirm} className="mt-6 space-y-4" noValidate>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
        <li>Install an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy).</li>
        <li>Scan this QR code, or enter the setup key manually.</li>
        <li>Type the 6-digit code the app shows.</li>
      </ol>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-white p-4">
        {enrollment ? (
          <img src={enrollment.qrDataUrl} alt="Authenticator setup QR code" width={200} height={200} />
        ) : (
          <div className="grid size-[200px] place-items-center text-sm text-muted">{error ? "Unavailable" : "Preparing…"}</div>
        )}
        {grouped && <p className="select-all break-all text-center font-mono text-xs text-muted" aria-label="Setup key">{grouped}</p>}
      </div>
      <Field label="6-digit code" htmlFor="enroll-code" required>
        <CodeInput id="enroll-code" value={code} onChange={(v) => { setCode(v); setError(""); }} />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" className="w-full justify-center" loading={busy} disabled={!enrollment}>Turn on two-factor authentication</Button>
    </form>
  );
}

/** Recovery codes are shown exactly once. The user must confirm they saved them before continuing. */
export function RecoveryCodes({ codes, onDone, doneLabel = "Continue" }: { codes: string[]; onDone: () => void; doneLabel?: string }) {
  const [saved, setSaved] = useState(false);
  const text = codes.join("\n");
  const download = () => {
    const url = URL.createObjectURL(new Blob([`Hamsavahin admin recovery codes\nEach code works once.\n\n${text}\n`], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "hamsavahin-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="mt-6 space-y-4">
      <p className="rounded-md bg-warn-50 px-3 py-2 text-sm text-warn-600" role="note">
        Save these recovery codes somewhere safe. They are shown <strong>only once</strong> and each works a single time if you lose your authenticator device.
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-canvas p-3 font-mono text-sm" aria-label="Recovery codes">
        {codes.map((c) => <li key={c} className="select-all text-center">{c}</li>)}
      </ul>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => { void navigator.clipboard?.writeText(text); toast.success("Recovery codes copied"); }}><Copy className="size-4" /> Copy</Button>
        <Button type="button" variant="secondary" size="sm" onClick={download}><Download className="size-4" /> Download</Button>
      </div>
      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" className="mt-0.5 size-4" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        I have saved my recovery codes in a safe place.
      </label>
      <Button type="button" className="w-full justify-center" disabled={!saved} onClick={onDone}>{doneLabel}</Button>
    </div>
  );
}
