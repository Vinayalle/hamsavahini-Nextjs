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
import { CodeInput, useCooldown } from "./otp";
import { NewPasswordFields } from "./password-field";

type Step = "email" | "code" | "password" | "done";
const COOLDOWN_SECONDS = 60;

const msg = (e: unknown, fallback = "Something went wrong. Try again.") =>
  e instanceof ApiClientError ? (e.status === 429 ? `Too many attempts. Try again ${e.retryAfterSeconds ? `in about ${Math.ceil(e.retryAfterSeconds / 60)} minute(s)` : "later"}.` : e.message) : fallback;

/**
 * First-time activation: (1) request a one-time code at the registered email, (2) verify it, (3) create a password.
 * The server never reveals whether the address has an invitation; the grant between steps 2 and 3 is an HttpOnly cookie.
 */
export function ActivatePage() {
  const params = useSearchParams();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown();

  if (!isApiMode) return <Unavailable />;

  const requestCode = async (resend = false) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await apiFetch(resend ? "/api/auth/verification/resend" : "/api/auth/activate/request-otp", { method: "POST", body: { email: email.trim() } });
      cooldown.start(COOLDOWN_SECONDS);
      setStep("code");
      setNotice(`If ${email.trim()} has a pending invitation, we sent a 6-digit code. It expires in 10 minutes.`);
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  };

  const onEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter the email address your invitation was sent to");
    void requestCode(false);
  };

  const onCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return setError("Enter the 6-digit code from the email");
    setBusy(true); setError("");
    try {
      await apiFetch("/api/auth/activate/verify-otp", { method: "POST", body: { email: email.trim(), code } });
      setStep("password");
      setNotice("");
    } catch (err) {
      setError(msg(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const onPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(password, { email: email.trim() });
    const errs: Record<string, string> = {};
    if (problem) errs.password = problem;
    if (password !== confirm) errs.confirm = "Passwords do not match";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setError("");
    try {
      await apiFetch("/api/auth/activate/set-password", { method: "POST", body: { password } });
      setStep("done");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "activation_expired") {
        setStep("email"); setCode(""); setPassword(""); setConfirm("");
        return setError("Your verification expired. Request a new code to continue.");
      }
      if (err instanceof ApiClientError && err.fields?.password) setFieldErrors({ password: err.fields.password });
      else setError(msg(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === "done") {
    return (
      <AuthShell title="Account activated">
        <p className="flex items-start gap-2 text-sm text-ink"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-600" aria-hidden /> Your email is verified and your password is set. Sign in with your email and password.</p>
        <Link href="/admin/login" className="mt-5 inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">Go to sign in</Link>
      </AuthShell>
    );
  }

  const titles: Record<Exclude<Step, "done">, [string, string]> = {
    email: ["Activate your account", "Enter the email address your invitation was sent to. We will send a one-time verification code."],
    code: ["Check your email", "Enter the 6-digit code we sent to verify your address."],
    password: ["Create your password", "Email verified. Choose a strong password to finish."],
  };
  const [title, subtitle] = titles[step];

  return (
    <AuthShell title={title} subtitle={subtitle}>
      <ol className="mb-5 flex gap-2 text-xs text-muted" aria-label="Progress">
        {(["email", "code", "password"] as const).map((s, i) => (
          <li key={s} className={step === s ? "font-semibold text-brand-600" : ""} aria-current={step === s ? "step" : undefined}>{i + 1}. {s === "email" ? "Email" : s === "code" ? "Verify" : "Password"}</li>
        ))}
      </ol>

      {step === "email" && (
        <form onSubmit={onEmail} className="space-y-4" noValidate>
          <Field label="Work email" htmlFor="act-email" required>
            <Input id="act-email" type="email" autoComplete="username" autoFocus value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" className="w-full justify-center" loading={busy}>Send verification code</Button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={onCode} className="space-y-4" noValidate>
          {notice && <InfoNote>{notice}</InfoNote>}
          <Field label="Verification code" htmlFor="act-code" required>
            <CodeInput id="act-code" value={code} autoFocus onChange={(v) => { setCode(v); setError(""); }} />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" className="w-full justify-center" loading={busy}>Verify email</Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" className="font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-faint disabled:no-underline" disabled={cooldown.left > 0 || busy} onClick={() => void requestCode(true)}>
              {cooldown.left > 0 ? `Resend code in ${cooldown.left}s` : "Resend code"}
            </button>
            <button type="button" className="text-muted hover:text-ink" onClick={() => { setStep("email"); setCode(""); setError(""); setNotice(""); }}>Use a different email</button>
          </div>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={onPassword} className="space-y-4" noValidate>
          <NewPasswordFields password={password} confirm={confirm} onPassword={(v) => { setPassword(v); setFieldErrors({}); }} onConfirm={(v) => { setConfirm(v); setFieldErrors({}); }} context={{ email: email.trim() }} error={fieldErrors.password} confirmError={fieldErrors.confirm} idPrefix="act" />
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" className="w-full justify-center" loading={busy}>Activate account</Button>
        </form>
      )}

      <Link href="/admin/login" className="mt-5 block text-sm font-medium text-brand-600 hover:underline">Back to sign in</Link>
    </AuthShell>
  );
}
