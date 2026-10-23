"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Logo } from "@/components/brand/Logo";
import { LuShieldAlert as ShieldAlert } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/fields";
import { Field } from "@/components/forms/form-parts";
import { PasswordInput } from "@/components/auth/password-field";
import { EmailCodeChallenge } from "@/components/auth/mfa";
import { ApiClientError, useAuth } from "@/lib/auth";
import { isApiMode } from "@/lib/api/client";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  // Mock mode keeps the old 8-character preview rule; the real server decides what is correct in api mode.
  password: isApiMode ? z.string().min(1, "Password is required") : z.string().min(8, "Password must be at least 8 characters"),
});
type Values = z.infer<typeof schema>;
type Step = "credentials" | "email";

export default function LoginPage() {
  const router = useRouter();
  // Only same-site admin paths are honoured, so a crafted ?next= cannot redirect to another website.
  const nextParam = useSearchParams().get("next");
  const destination = nextParam && /^\/admin\/[A-Za-z0-9/_-]*$/.test(nextParam) && !nextParam.startsWith("//") ? nextParam : "/admin/dashboard";
  const { user, ready, signIn, completeMfa, restoreSession, sessionExpired } = useAuth();
  const [step, setStep] = useState<Step>("credentials");
  const [notice, setNotice] = useState("");
  const [maskedEmail, setMaskedEmail] = useState<string | undefined>();
  const restoring = useRef(false);
  const { register, control, handleSubmit, setError, setValue, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // Already signed in: go to the destination.
  useEffect(() => {
    if (ready && user) router.replace(destination);
  }, [ready, user, router, destination]);

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
        setMaskedEmail(r.maskedEmail);
        return setStep("email");
      }
      router.replace(destination);
    } catch (e) {
      setError("root", { message: e instanceof ApiClientError ? (e.status === 429 ? "Too many attempts. Wait a few minutes and try again." : e.message) : "Could not sign in. Try again." });
    }
  };

  return (
    <main className="flex min-h-screen">
      <section className="relative hidden w-1/2 flex-col justify-between bg-bark-900 p-12 text-white lg:flex">
        <Logo variant="lockup" priority className="h-12" />
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

          {step === "email" && (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">Check your email</h2>
              <p className="mt-1 text-sm text-muted">One more step to finish signing in.</p>
              <EmailCodeChallenge maskedEmail={maskedEmail} onSubmit={async (input) => { await completeMfa(input); router.replace(destination); }} onExpired={() => backToStart()} />
              <button type="button" className="mt-4 text-sm text-muted hover:text-ink" onClick={() => backToStart("")}>Back to sign in</button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
