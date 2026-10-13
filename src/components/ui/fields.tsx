"use client";

import * as React from "react";
import { LuLoaderCircle as Loader2 } from "react-icons/lu";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-faint transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-canvas disabled:text-faint aria-[invalid=true]:border-danger-600";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(base, "h-9", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(base, "py-2 leading-relaxed", className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(base, "h-9 pr-8", className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-ink", className)} {...props} />;
}

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn("size-4 cursor-pointer rounded border-line accent-brand-600", className)}
        {...props}
      />
    );
  },
);

/** If `onChange` returns a promise (a switch that saves on the server straight away), the switch shows a spinner and ignores clicks until it settles. */
export function Switch({
  checked, onChange, label, disabled,
}: { checked: boolean; onChange: (v: boolean) => unknown; label: string; disabled?: boolean }) {
  const [pending, setPending] = React.useState(false);
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const toggle = () => {
    const result = onChange(!checked);
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      setPending(true);
      const done = () => { if (mounted.current) setPending(false); };
      Promise.resolve(result).then(done, (error) => { done(); throw error; });
    }
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      onClick={toggle}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-brand-600" : "bg-slate-300",
      )}
    >
      <span
        className={cn("inline-flex size-4 items-center justify-center rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")}
      >
        {pending && <Loader2 className="size-3 animate-spin text-slate-500" aria-hidden />}
      </span>
    </button>
  );
}
