"use client";

import { useMemo, useState } from "react";
import { LuCheck as Check, LuCircle as Circle, LuEye as Eye, LuEyeOff as EyeOff } from "react-icons/lu";
import { Input } from "@/components/ui/fields";
import { Field } from "@/components/forms/form-parts";
import { checkPassword, passwordStrength, type PasswordContext } from "@/lib/authz/password-policy";
import { cn } from "@/lib/utils";

/**
 * Live requirement checklist. It uses the SAME policy module as the server (src/lib/authz/password-policy), so what the
 * user sees is exactly what the server enforces. The checklist is guidance only: the server is the authority.
 */
export function PasswordChecklist({ value, context }: { value: string; context?: PasswordContext }) {
  const reqs = useMemo(() => checkPassword(value, context).requirements.filter((r) => r.applicable), [value, context]);
  return (
    <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2" aria-label="Password requirements">
      {reqs.map((r) => {
        const ok = value.length > 0 && r.met;
        return (
          <li key={r.id} className={cn("flex items-start gap-1.5", ok ? "text-success-600" : "text-muted")}>
            {ok ? <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <Circle className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
            <span><span className="sr-only">{ok ? "Met: " : "Not met: "}</span>{r.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

const BAR = ["bg-danger-600", "bg-danger-600", "bg-amber-500", "bg-success-600", "bg-success-600"] as const;

export function StrengthMeter({ value, context }: { value: string; context?: PasswordContext }) {
  const s = useMemo(() => passwordStrength(value, context), [value, context]);
  return (
    <div aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full bg-line", value && i < Math.max(1, s.score) && BAR[s.score])} />
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">Strength: <span className="font-medium text-ink">{value ? s.label : "—"}</span></p>
    </div>
  );
}

/** Password input with a show/hide toggle. */
export function PasswordInput({
  id, value, onChange, autoComplete, invalid, ...rest
}: { id: string; value: string; onChange: (v: string) => void; autoComplete: "current-password" | "new-password"; invalid?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type" | "id" | "autoComplete">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} value={value} aria-invalid={invalid} className="pr-10" onChange={(e) => onChange(e.target.value)} {...rest} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
      >
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

/** New password + confirmation + checklist + strength meter. */
export function NewPasswordFields({
  password, confirm, onPassword, onConfirm, context, error, confirmError, idPrefix = "np",
}: {
  password: string; confirm: string; onPassword: (v: string) => void; onConfirm: (v: string) => void;
  context?: PasswordContext; error?: string; confirmError?: string; idPrefix?: string;
}) {
  return (
    <div className="space-y-4">
      <Field label="New password" htmlFor={`${idPrefix}-password`} required error={error}>
        <PasswordInput id={`${idPrefix}-password`} value={password} onChange={onPassword} autoComplete="new-password" invalid={!!error} />
      </Field>
      <StrengthMeter value={password} context={context} />
      <PasswordChecklist value={password} context={context} />
      <Field label="Confirm password" htmlFor={`${idPrefix}-confirm`} required error={confirmError}>
        <PasswordInput id={`${idPrefix}-confirm`} value={confirm} onChange={onConfirm} autoComplete="new-password" invalid={!!confirmError} />
      </Field>
    </div>
  );
}
