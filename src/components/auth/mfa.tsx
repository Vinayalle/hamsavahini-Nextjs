"use client";

import { useEffect, useState } from "react";
import { LuLoaderCircle as Loader2 } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/forms/form-parts";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { CodeInput, useCooldown } from "./otp";
import { ErrorNote } from "./auth-shell";

const message = (e: unknown, fallback: string) => (e instanceof ApiClientError ? (e.status === 429 ? "Too many attempts. Wait a few minutes and try again." : e.message) : fallback);

/** Second step of sign-in: type the 6-digit code from the email; resend after the cooldown. */
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

  const [sending, setSending] = useState(false);
  const resend = async () => {
    setError(""); setNotice("");
    setSending(true);
    try {
      const r = await apiFetch<{ sent: boolean; retryAfterSeconds: number | null }>("/api/auth/mfa/resend", { method: "POST", body: {} });
      cooldown.start(r.retryAfterSeconds ?? 60);
      setNotice(r.sent ? "A new code was sent." : "A code was already sent a moment ago. Check your inbox (and spam).");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "mfa_session_expired") return onExpired();
      setError(message(err, "Could not send a new code."));
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      <p className="text-sm text-ink">We emailed a 6-digit sign-in code to <strong>{maskedEmail ?? "your email address"}</strong>. It expires in 10 minutes.</p>
      <Field label="Sign-in code" htmlFor="email-code" required>
        <CodeInput id="email-code" value={code} autoFocus onChange={(v) => { setCode(v); setError(""); }} />
      </Field>
      {notice && <p className="rounded-md bg-success-50 px-3 py-2 text-sm text-success-600" role="status">{notice}</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" className="w-full justify-center" loading={busy}>Verify and sign in</Button>
      <button type="button" className="block w-full text-center text-sm font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-faint disabled:no-underline" disabled={cooldown.left > 0 || sending} onClick={() => resend()}>
        {sending ? <span className="inline-flex items-center justify-center gap-1.5"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Sending…</span> : cooldown.left > 0 ? `Resend code in ${cooldown.left}s` : "Didn't get it? Send a new code"}
      </button>
    </form>
  );
}
