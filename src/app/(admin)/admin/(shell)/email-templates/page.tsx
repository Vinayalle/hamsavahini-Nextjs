"use client";

import { useState } from "react";
import { LuEye as Eye, LuPencil as Pencil, LuPlus as Plus } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import type { Column } from "@/components/admin/data-table";
import { EntityFormDialog, type SectionDef, type Values } from "@/components/forms/entity-form";
import { templateService } from "@/lib/services";
import { formatDate } from "@/lib/utils";
import type { EmailTemplate } from "@/types/entities";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const extractVars = (...texts: string[]) => Array.from(new Set(texts.flatMap((t) => Array.from(t.matchAll(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g)).map((m) => m[1]))));
const SAMPLE: Record<string, string> = { name: "Alex Morgan", reference: "RFQ-2026-1099", product: "Copper Cathode Grade A", role: "Senior Trader", link: "https://example.invalid/set-password" };
const render = (t: string) => t.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, k: string) => SAMPLE[k] ?? `[${k}]`);

export default function EmailTemplatesPage() {
  const [editing, setEditing] = useState<EmailTemplate | "new" | null>(null);
  const [preview, setPreview] = useState<EmailTemplate | null>(null);
  const current = editing && editing !== "new" ? editing : undefined;

  const sections: SectionDef[] = [{
    title: "Template",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "key", label: "System key", type: "text", required: true, maxLength: 60, hint: "Used by the backend to pick the template, e.g. enquiry_ack.", placeholder: "enquiry_ack" },
      { name: "subject", label: "Subject", type: "text", required: true, wide: true, hint: "Use {{variable}} placeholders, e.g. {{name}}" },
      { name: "body", label: "Body", type: "textarea", required: true, rows: 9, wide: true, minLength: 20 },
      { name: "active", label: "Active", type: "switch", switchText: ["Active — emails will be sent", "Inactive — emails are suppressed"] },
    ],
  }];

  const columns: Column<EmailTemplate>[] = [
    { key: "name", header: "Template", sortKey: "name", cell: (t) => (<div><span className="font-medium text-ink">{t.name}</span><span className="block font-mono text-xs text-muted">{t.key}</span></div>) },
    { key: "subject", header: "Subject", hideBelow: "md", cell: (t) => <span className="line-clamp-1 max-w-xs text-muted">{t.subject}</span> },
    { key: "vars", header: "Variables", hideBelow: "lg", cell: (t) => <span className="text-xs text-muted">{t.variables.map((v) => `{{${v}}}`).join(" ")}</span> },
    { key: "active", header: "Status", sortKey: "active", cell: (t) => <StatusBadge status={t.active ? "active" : "inactive"} /> },
    { key: "updated", header: "Updated", sortKey: "updatedAt", hideBelow: "lg", cell: (t) => <span className="text-muted">{formatDate(t.updatedAt)}</span> },
  ];

  const save = async (v: Values) => {
    const payload = {
      key: str(v.key), name: str(v.name), subject: str(v.subject), body: str(v.body), active: !!v.active,
      variables: extractVars(str(v.subject), str(v.body)),
    };
    if (current) await templateService.update(current.id, payload);
    else await templateService.create(payload);
    toast.success(current ? "Template updated" : "Template created");
    setEditing(null);
  };

  const add = <Button onClick={() => setEditing("new")}><Plus className="size-4" /> New template</Button>;

  return (
    <>
      <PageHeader title="Email Templates" description="Transactional emails sent for enquiries, RFQs, applications and invitations." actions={add} />
      <ResourceList
        service={templateService} entityLabel="template" nameOf={(t) => t.name} columns={columns}
        defaultSort={{ by: "name", dir: "asc" }} searchPlaceholder="Search templates…" emptyAction={add}
        extraRowActions={(t) => [
          { label: "Preview", icon: Eye, onSelect: () => setPreview(t) },
          { label: "Edit", icon: Pencil, onSelect: () => setEditing(t) },
          { label: t.active ? "Deactivate" : "Activate", onSelect: async () => { await templateService.update(t.id, { active: !t.active }); toast.success(t.active ? "Template deactivated" : "Template activated"); } },
        ]}
        filters={[{ key: "active", label: "Status", options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] }]}
      />
      <EntityFormDialog
        open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={current ? "Edit template" : "New template"}
        sections={sections}
        defaultValues={current ? { ...current } : { name: "", key: "", subject: "", body: "", active: true }}
        validate={(v) => templateService.snapshot().some((t) => t.id !== current?.id && t.key === v.key) ? { key: "Another template uses this key" } : null}
        submitLabel={current ? "Save changes" : "Create template"} onSubmit={save}
      />
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg p-6">
          <DialogTitle>Preview</DialogTitle>
          <DialogDescription>Rendered with sample values. Nothing is sent.</DialogDescription>
          {preview && (
            <div className="mt-4 rounded-lg border border-line">
              <p className="border-b border-line bg-canvas px-4 py-2.5 text-sm"><span className="text-muted">Subject: </span><span className="font-medium">{render(preview.subject)}</span></p>
              <p className="whitespace-pre-wrap px-4 py-4 text-sm leading-relaxed">{render(preview.body)}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
