import { cn } from "@/lib/utils";

type Tone = "success" | "warn" | "danger" | "info" | "neutral" | "purple";

const tones: Record<Tone, string> = {
  success: "bg-success-50 text-success-600 ring-green-600/20",
  warn: "bg-warn-50 text-warn-600 ring-amber-600/20",
  danger: "bg-danger-50 text-danger-600 ring-red-600/20",
  info: "bg-brand-50 text-brand-700 ring-brand-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/20",
  purple: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

/** Single source of truth for status → colour across the admin. */
const STATUS_TONE: Record<string, Tone> = {
  published: "success", active: "success", open: "success", sent: "success", won: "success", resolved: "success",
  hired: "success", completed: "success", quoted: "info", offer: "success",
  available: "success", requirement_open: "success", limited_availability: "warn", under_negotiation: "purple", under_discussion: "purple",
  contacted: "info", quotation_sent: "info", sold: "neutral",
  draft: "warn", pending: "warn", invited: "warn", queued: "warn", under_review: "warn", planning: "warn",
  in_review: "warn", in_progress: "info", screening: "info", interview: "purple", negotiation: "purple",
  new: "info",
  archived: "neutral", closed: "neutral", on_hold: "neutral", inactive: "neutral",
  failed: "danger", rejected: "danger", lost: "danger", suspended: "danger", spam: "danger",
};

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function StatusBadge({ status, label, tone, className }: { status: string; label?: string; tone?: Tone; className?: string }) {
  const t = tone ?? STATUS_TONE[status] ?? "neutral";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", tones[t], className)}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {label ?? statusLabel(status)}
    </span>
  );
}
