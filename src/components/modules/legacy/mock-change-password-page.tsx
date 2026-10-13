"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LuEye as Eye, LuEyeOff as EyeOff, LuInfo as Info } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/fields";
import { Field } from "@/components/forms/form-parts";
import { PageHeader } from "@/components/admin/page-parts";
import { useUnsavedChangesGuard } from "@/components/admin/dialogs";

const schema = z.object({
  current: z.string().min(1, "Enter your current password"),
  next: z.string()
    .min(12, "Use at least 12 characters")
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[0-9]/, "Include a number")
    .regex(/[^A-Za-z0-9]/, "Include a symbol"),
  confirm: z.string().min(1, "Confirm your new password"),
}).refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Passwords do not match" })
  .refine((v) => v.next !== v.current, { path: ["next"], message: "New password must differ from the current one" });
type Values = z.infer<typeof schema>;

const RULES: [string, (p: string) => boolean][] = [
  ["12+ characters", (p) => p.length >= 12],
  ["Lowercase letter", (p) => /[a-z]/.test(p)],
  ["Uppercase letter", (p) => /[A-Z]/.test(p)],
  ["Number", (p) => /[0-9]/.test(p)],
  ["Symbol", (p) => /[^A-Za-z0-9]/.test(p)],
];

export function MockChangePasswordPage() {
  const [show, setShow] = useState(false);
  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting, isDirty } } = useForm<Values>({
    resolver: zodResolver(schema), defaultValues: { current: "", next: "", confirm: "" },
  });
  const { dialog } = useUnsavedChangesGuard(isDirty && !isSubmitting);
  const next = useWatch({ control, name: "next" }) ?? "";

  const onSubmit = () => {
    // Nothing is sent or stored. Real flow: POST to the auth API over HTTPS; backend verifies the current password.
    reset();
    toast.success("Validated successfully", { description: "Mock only — no password was changed or stored." });
  };

  return (
    <>
      <PageHeader title="Change Password" description="Choose a strong password you don't use anywhere else." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="lg:col-span-2">
          <Card>
            <CardHeader title="Update password" />
            <div className="max-w-md space-y-4 p-5">
              <Field label="Current password" htmlFor="current" required error={errors.current?.message}>
                <Input id="current" type={show ? "text" : "password"} autoComplete="current-password" aria-invalid={!!errors.current} {...register("current")} />
              </Field>
              <Field label="New password" htmlFor="next" required error={errors.next?.message}>
                <Input id="next" type={show ? "text" : "password"} autoComplete="new-password" aria-invalid={!!errors.next} {...register("next")} />
              </Field>
              <Field label="Confirm new password" htmlFor="confirm" required error={errors.confirm?.message}>
                <Input id="confirm" type={show ? "text" : "password"} autoComplete="new-password" aria-invalid={!!errors.confirm} {...register("confirm")} />
              </Field>
              <button type="button" onClick={() => setShow((s) => !s)} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {show ? "Hide" : "Show"} passwords
              </button>
              <div className="flex justify-end pt-2"><Button type="submit" loading={isSubmitting}>Update password</Button></div>
            </div>
          </Card>
          {dialog}
        </form>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Requirements" />
            <ul className="space-y-1.5 p-5 text-sm">
              {RULES.map(([label, test]) => (
                <li key={label} className={test(next) ? "text-success-600" : "text-muted"}>{test(next) ? "✓" : "○"} {label}</li>
              ))}
            </ul>
          </Card>
          <div className="flex gap-2.5 rounded-lg border border-brand-200 bg-brand-50 p-3 text-[13px] text-brand-700">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>Development preview: this form validates input only. Passwords are never saved, logged or sent anywhere.</p>
          </div>
        </div>
      </div>
    </>
  );
}
