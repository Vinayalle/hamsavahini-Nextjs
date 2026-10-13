"use client";

import hotToast, { Toaster, type Toast } from "react-hot-toast";
import { LuCircleAlert, LuCircleCheck, LuInfo, LuTriangleAlert, LuX } from "react-icons/lu";
import type { IconType } from "react-icons";
import { cn } from "@/lib/utils";

/**
 * The project's one notification API, built on react-hot-toast.
 *
 *   toast.success("Saved", { description: "Saved to the database." })
 *   toast.error("Could not save")
 *
 * Every toast is the same card (icon, title, optional description, close button). `<AppToaster />` is mounted once in the root layout.
 */
type Kind = "success" | "error" | "info" | "warning";
interface Options {
  description?: string;
  /** Milliseconds on screen. Errors stay longer by default. */
  duration?: number;
  id?: string;
}

const LOOK: Record<Kind, { icon: IconType; tile: string; ring: string }> = {
  success: { icon: LuCircleCheck, tile: "bg-success-50 text-success-600", ring: "border-success-600/20" },
  error: { icon: LuCircleAlert, tile: "bg-danger-50 text-danger-600", ring: "border-danger-600/25" },
  warning: { icon: LuTriangleAlert, tile: "bg-warn-50 text-warn-600", ring: "border-warn-600/25" },
  info: { icon: LuInfo, tile: "bg-brand-50 text-brand-600", ring: "border-brand-600/20" },
};

function Card({ t, kind, message, description }: { t: Toast; kind: Kind; message: string; description?: string }) {
  const look = LOOK[kind];
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-[min(92vw,380px)] items-start gap-3 rounded-xl border bg-surface p-3.5 pr-3 shadow-pop",
        look.ring,
        t.visible ? "toast-in" : "toast-out",
      )}
    >
      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", look.tile)} aria-hidden>
        <look.icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-sm font-semibold leading-snug text-ink">{message}</p>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-muted">{description}</p>}
      </div>
      <button type="button" onClick={() => hotToast.dismiss(t.id)} aria-label="Dismiss notification" className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-faint hover:bg-canvas hover:text-ink">
        <LuX className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function show(kind: Kind, message: string, options: Options = {}) {
  return hotToast.custom((t) => <Card t={t} kind={kind} message={message} description={options.description} />, {
    id: options.id,
    duration: options.duration ?? (kind === "error" ? 7000 : 4500),
  });
}

export const toast = {
  success: (message: string, options?: Options) => show("success", message, options),
  error: (message: string, options?: Options) => show("error", message, options),
  warning: (message: string, options?: Options) => show("warning", message, options),
  info: (message: string, options?: Options) => show("info", message, options),
  dismiss: (id?: string) => hotToast.dismiss(id),
};

export function AppToaster() {
  return <Toaster position="top-right" gutter={10} containerStyle={{ top: 76 }} toastOptions={{ style: { background: "transparent", boxShadow: "none", padding: 0, maxWidth: "none" } }} />;
}
