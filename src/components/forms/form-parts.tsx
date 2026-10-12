"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote, X } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FormSection({
  title, description, children, className,
}: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title={title} description={description} />
      <div className="space-y-4 p-5">{children}</div>
    </Card>
  );
}

export function Field({
  label, htmlFor, error, hint, required, className, children,
}: {
  label: string; htmlFor?: string; error?: string; hint?: string; required?: boolean;
  className?: string; children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-danger-600" aria-hidden>*</span>}
      </Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger-600" role="alert">{error}</p>}
    </div>
  );
}

export function FormActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {children}
    </div>
  );
}

/* ───────────────────────── TagInput ───────────────────────── */
export function TagInput({
  value, onChange, placeholder = "Type and press Enter", id,
}: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; id?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-white p-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded bg-canvas px-2 py-0.5 text-xs text-ink">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}><X className="size-3" /></button>
        </span>
      ))}
      <input
        id={id} value={draft} placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        className="min-w-24 flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-faint"
      />
    </div>
  );
}

/* ───────────────────────── RichTextEditor ───────────────────────── */
const RTE_TOOLS = [
  { icon: Bold, label: "Bold", cmd: "bold" },
  { icon: Italic, label: "Italic", cmd: "italic" },
  { icon: Heading2, label: "Heading", cmd: "h2" },
  { icon: List, label: "Bulleted list", cmd: "insertUnorderedList" },
  { icon: ListOrdered, label: "Numbered list", cmd: "insertOrderedList" },
  { icon: Quote, label: "Quote", cmd: "blockquote" },
  { icon: Link2, label: "Link", cmd: "createLink" },
];

/**
 * Lightweight contentEditable editor producing HTML. Intended for trusted admin authors only.
 * The backend MUST sanitize this HTML before storing/rendering it on the public site.
 */
export function RichTextEditor({
  value, onChange, id, minHeight = 220, invalid,
}: { value: string; onChange: (html: string) => void; id?: string; minHeight?: number; invalid?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  // Initialise once and when the value is replaced from outside (e.g. form reset).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(ref.current?.innerHTML ?? "");
  };

  const run = (cmd: string) => {
    if (cmd === "createLink") {
      const url = window.prompt("Link URL (https://…)");
      if (url && /^https?:\/\//i.test(url)) exec("createLink", url);
      return;
    }
    if (cmd === "h2" || cmd === "blockquote") exec("formatBlock", cmd);
    else exec(cmd);
  };

  return (
    <div className={cn("rounded-md border bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20", invalid ? "border-danger-600" : "border-line")}>
      <div className="flex flex-wrap gap-0.5 border-b border-line p-1" role="toolbar" aria-label="Formatting">
        {RTE_TOOLS.map((t) => (
          <Button key={t.label} variant="ghost" size="icon" className="size-8" aria-label={t.label} title={t.label} onMouseDown={(e) => e.preventDefault()} onClick={() => run(t.cmd)}>
            <t.icon className="size-4" />
          </Button>
        ))}
      </div>
      <div
        ref={ref}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-label="Content"
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        className="rte-content prose-sm max-w-none px-3 py-2 text-sm leading-relaxed outline-none"
        style={{ minHeight }}
      />
    </div>
  );
}
