"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/fields";
import { Field } from "@/components/forms/form-parts";
import { ApiClientError, apiFetch, isApiMode } from "@/lib/api/client";
import { passwordProblem } from "@/lib/authz/password-policy";
import { AuthShell, ErrorNote, InfoNote, Unavailable } from "./auth-shell";
import { NewPasswordFields } from "./password-field";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  if (!isApiMode) return <Unavailable />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address");
    setBusy(true);
    try {
      await apiFetch("/api/auth/password/forgot", { method: "POST", body: { email } });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? (err.status === 429 ? "Too many requests. Try again later." : err.message) : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your work email and we will send a reset link if an active account exists.">
      {sent ? (
        <InfoNote>If an active account exists for that email, a reset link has been sent. It is valid for one hour and works once.</InfoNote>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Work email" htmlFor="fp-email" required><Input id="fp-email" type="email" autoComplete="username" autoFocus value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} /></Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" className="w-full justify-center" loading={busy}>Send reset link</Button>
        </form>
      )}
      <Link href="/admin/login" className="mt-5 block text-sm font-medium text-brand-600 hover:underline">Back to sign in</Link>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (!isApiMode) return <Unavailable />;

  if (!token) {
    return (
      <AuthShell title="Link not valid" subtitle="This link is incomplete. Open the link from your email again, or request a new one.">
        <Link href="/admin/forgot-password" className="text-sm font-medium text-brand-600 hover:underline">Request a new link</Link>
      </AuthShell>
    );
  }
  if (done) {
    return (
      <AuthShell title="Password updated">
        <p className="flex items-start gap-2 text-sm text-ink"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-600" aria-hidden /> Your password was changed and every device was signed out.</p>
        <Link href="/admin/login" className="mt-5 inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">Sign in</Link>
      </AuthShell>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(password);
    const errs: Record<string, string> = {};
    if (problem) errs.password = problem;
    if (password !== confirm) errs.confirm = "Passwords do not match";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setError("");
    try {
      await apiFetch("/api/auth/password/reset", { method: "POST", body: { token, password } });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiClientError && err.fields?.password) setErrors({ password: err.fields.password });
      else setError(err instanceof ApiClientError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="Choose a new password. All your devices will be signed out.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <NewPasswordFields password={password} confirm={confirm} onPassword={(v) => { setPassword(v); setErrors({}); }} onConfirm={(v) => { setConfirm(v); setErrors({}); }} error={errors.password} confirmError={errors.confirm} idPrefix="rp" />
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" className="w-full justify-center" loading={busy}>Update password</Button>
      </form>
    </AuthShell>
  );
}
