"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldAlert, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/fields";
import { Field } from "@/components/forms/form-parts";
import { PasswordInput } from "@/components/auth/password-field";
import { MfaChallenge, MfaEnrollment, RecoveryCodes } from "@/components/auth/mfa";
import { ApiClientError, useAuth } from "@/lib/auth";
import { isApiMode } from "@/lib/api/client";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  // Mock mode keeps the old 8-character preview rule; the real server decides what is correct in api mode.
  password: isApiMode ? z.string().min(1, "Password is required") : z.string().min(8, "Password must be at least 8 characters"),
});
type Values = z.infer<typeof schema>;
type Step = "credentials" | "mfa" | "enroll" | "recovery";

export default function LoginPage() {
  const router = useRouter();
  // Only same-site admin paths are honoured, so a crafted ?next= cannot redirect to another website.
  const nextParam = useSearchParams().get("next");
  const destination = nextParam && /^\/admin\/[A-Za-z0-9/_-]*$/.test(nextParam) && !nextParam.startsWith("//") ? nextParam : "/admin/dashboard";
  const { user, ready, signIn, completeMfa, finishSignIn, restoreSession, sessionExpired } = useAuth();
  const [step, setStep] = useState<Step>("credentials");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const restoring = useRef(false);
  const { register, control, handleSubmit, setError, setValue, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // Already signed in (and not in the middle of enrolment): go to the destination.
  useEffect(() => {
    if (ready && user && step !== "recovery") router.replace(destination);
  }, [ready, user, router, destination, step]);

  // The access token is short-lived. If we were redirected here only because it expired, quietly renew the session.
  useEffect(() => {
    if (!isApiMode || !ready || user || restoring.current) return;
    restoring.current = true;
    void restoreSession();
  }, [ready, user, restoreSession]);

  const backToStart = (message = "Your sign-in step expired. Sign in again.") => {
    setStep("credentials");
    setNotice(message);
    setValue("password", "");
  };

  const onSubmit = async (values: Values) => {
    setNotice("");
    try {
      // Mock mode (dev only) ignores the password. API mode verifies it on the server.
      const r = await signIn(values.email, values.password);
      if (r.status === "mfa_required") {
        setValue("password", "");
        return setStep(r.enrolled ? "mfa" : "enroll");
      }
      router.replace(destination);
    } catch (e) {
      setError("root", { message: e instanceof ApiClientError ? (e.status === 429 ? "Too many attempts. Wait a few minutes and try again." : e.message) : "Could not sign in. Try again." });
    }
  };

  return (
    <main className="flex min-h-screen">
      <section className="relative hidden w-1/2 flex-col justify-between bg-navy-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600"><Waves className="size-5" aria-hidden /></span>
          <span className="text-lg font-semibold tracking-tight">Hamsavahin</span>
        </div>
        <div>
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Manage your global trade presence from one place.
          </h1>
          <p className="mt-4 max-w-md text-slate-300">
            Products, content, enquiries and website configuration for Hamsavahin&apos;s industrial and commodities business.
          </p>
        </div>
        <p className="text-sm text-slate-400">Authorised personnel only</p>
      </section>

      <section className="flex flex-1 items-center justify-center bg-surface px-6 py-12">
        <div className="w-full max-w-sm">
          {step === "credentials" && (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h2>
              <p className="mt-1 text-sm text-muted">Access the Hamsavahin admin.</p>

              {!isApiMode && (
                <div className="mt-5 flex gap-2.5 rounded-lg border border-amber-200 bg-warn-50 p-3 text-[13px] text-warn-600" role="note">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p><strong>Development preview.</strong> No real authentication is connected. Any valid-looking email and an 8+ character password will open a mock Super Admin session. Nothing is verified or stored.</p>
                </div>
              )}
              {sessionExpired && !notice && <p className="mt-5 rounded-md bg-warn-50 px-3 py-2 text-sm text-warn-600" role="status">Your session ended. Please sign in again.</p>}
              {notice && <p className="mt-5 rounded-md bg-warn-50 px-3 py-2 text-sm text-warn-600" role="status">{notice}</p>}

              <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
                <Field label="Email" htmlFor="email" required error={errors.email?.message}>
                  <Input id="email" type="email" autoComplete="username" aria-invalid={!!errors.email} placeholder="you@company.com" {...register("email")} />
                </Field>
                <Field label="Password" htmlFor="password" required error={errors.password?.message}>
                  <Controller control={control} name="password" render={({ field }) => (
                    <PasswordInput id="password" autoComplete="current-password" invalid={!!errors.password} value={field.value} onChange={field.onChange} />
                  )} />
                </Field>
                {errors.root && <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600" role="alert">{errors.root.message}</p>}
                <Button type="submit" className="w-full justify-center" loading={isSubmitting}>Sign in</Button>
                {isApiMode && (
                  <div className="space-y-1 text-center text-sm">
                    <p><Link href="/admin/forgot-password" className="font-medium text-brand-600 hover:underline">Forgot your password?</Link></p>
                    <p className="text-muted">New employee? <Link href="/admin/activate" className="font-medium text-brand-600 hover:underline">Activate your account</Link></p>
                  </div>
                )}
              </form>
            </>
          )}

          {step === "mfa" && (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">Two-factor verification</h2>
              <p className="mt-1 text-sm text-muted">Your role requires a second step to sign in.</p>
              <MfaChallenge onSubmit={async (input) => { await completeMfa(input); router.replace(destination); }} onExpired={() => backToStart()} />
              <button type="button" className="mt-4 text-sm text-muted hover:text-ink" onClick={() => backToStart("")}>Back to sign in</button>
            </>
          )}

          {step === "enroll" && (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">Set up two-factor authentication</h2>
              <p className="mt-1 text-sm text-muted">Your role requires it. This takes about a minute.</p>
              <MfaEnrollment onExpired={() => backToStart()} onEnrolled={async (codes) => {
                // Show the one-time codes first: once the session loads, the redirect-when-signed-in effect would otherwise fire.
                setRecoveryCodes(codes);
                setStep("recovery");
                await finishSignIn();
              }} />
              <button type="button" className="mt-4 text-sm text-muted hover:text-ink" onClick={() => backToStart("")}>Back to sign in</button>
            </>
          )}

          {step === "recovery" && (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">Two-factor authentication is on</h2>
              <RecoveryCodes codes={recoveryCodes} onDone={() => { setRecoveryCodes([]); router.replace(destination); }} doneLabel="Continue to the dashboard" />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
