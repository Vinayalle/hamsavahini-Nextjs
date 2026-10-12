"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/fields";
import type { InternalNote } from "@/types/entities";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn, formatDate } from "@/lib/utils";

/* ───────────────────────── DetailDrawer ───────────────────────── */
export function DetailDrawer({
  open, onOpenChange, title, description, children, footer,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" className="max-w-xl">
        <div className="border-b border-line px-6 py-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-3">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}

/** Label/value rows for detail views. */
export function DetailList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">{i.label}</dt>
          <dd className="mt-1 break-words text-sm text-ink">{i.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ───────────────────────── ActivityTimeline ───────────────────────── */
export interface TimelineEntry {
  id: string;
  title: React.ReactNode;
  meta?: string;
  at: string;
  tone?: "info" | "success" | "warn" | "danger" | "neutral";
}

const dot = {
  info: "bg-brand-500", success: "bg-green-600", warn: "bg-amber-500", danger: "bg-red-600", neutral: "bg-slate-400",
};

export function ActivityTimeline({ entries, empty = "No activity yet." }: { entries: TimelineEntry[]; empty?: string }) {
  if (entries.length === 0) return <p className="px-5 py-6 text-sm text-muted">{empty}</p>;
  return (
    <ol className="relative px-5 py-4">
      <span className="absolute bottom-6 left-[27px] top-6 w-px bg-line" aria-hidden />
      {entries.map((e) => (
        <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
          <span className={cn("relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-white", dot[e.tone ?? "neutral"])} aria-hidden />
          <div className="min-w-0">
            <p className="text-sm text-ink">{e.title}</p>
            <p className="text-xs text-muted">{e.meta && `${e.meta} · `}{formatDate(e.at, true)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ───────────────────────── NotesPanel ───────────────────────── */
export function NotesPanel({ notes, onAdd }: { notes: InternalNote[]; onAdd: (text: string) => void | Promise<void> }) {
  const [text, setText] = useState("");
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">Internal notes</h3>
      <p className="mb-3 text-xs text-muted">Only visible to admins. Never shown to the sender.</p>
      {notes.length === 0 ? (
        <p className="mb-3 text-sm text-muted">No notes yet.</p>
      ) : (
        <ul className="mb-3 space-y-2">
          {[...notes].reverse().map((n) => (
            <li key={n.id} className="rounded-lg bg-canvas px-3 py-2">
              <p className="whitespace-pre-wrap text-sm text-ink">{n.text}</p>
              <p className="mt-1 text-xs text-muted">{n.author} · {formatDate(n.createdAt, true)}</p>
            </li>
          ))}
        </ul>
      )}
      <Textarea aria-label="Add internal note" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note…" />
      <div className="mt-2 flex justify-end">
        <Button size="sm" disabled={!text.trim()} onClick={async () => { try { await onAdd(text.trim()); setText(""); } catch { /* the caller reports the error; keep the text so it can be retried */ } }}>Add note</Button>
      </div>
    </div>
  );
}
