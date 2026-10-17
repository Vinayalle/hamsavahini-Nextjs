"use client";

import { useState } from "react";
import { LuDownload as Download, LuFileText as FileText, LuPencil as Pencil, LuPlus as Plus } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import type { Column } from "@/components/admin/data-table";
import { EntityFormDialog, type SectionDef, type Values } from "@/components/forms/entity-form";
import { DocumentUploadDialog } from "@/components/modules/document-upload";
import { ApiClientError, apiDownload, isApiMode } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { documentService } from "@/lib/services";
import { formatBytes, formatDate } from "@/lib/utils";
import type { DocumentFile } from "@/types/entities";

const CATEGORIES: DocumentFile["category"][] = ["Certificate", "Policy", "Brochure", "Datasheet", "Legal", "Report"];
const str = (v: unknown) => (typeof v === "string" ? v : "");

const sections: SectionDef[] = [{
  title: "Document",
  fields: [
    { name: "title", label: "Title", type: "text", required: true, wide: true },
    { name: "category", label: "Category", type: "select", required: true, options: CATEGORIES.map((c) => ({ value: c, label: c })) },
    { name: "version", label: "Version", type: "text", required: true, placeholder: "1.0" },
    { name: "fileName", label: "File", type: "file", required: true, wide: true, hint: "PDF, Word or Excel up to 10 MB. Only the file name is recorded in this build." },
    { name: "sizeBytes", label: "Size", type: "number", hidden: true },
    { name: "mimeType", label: "Type", type: "text", hidden: true },
    { name: "visibility", label: "Visibility", type: "select", required: true, options: [{ value: "public", label: "Public (downloadable on website)" }, { value: "internal", label: "Internal only" }] },
    { name: "status", label: "Status", type: "select", required: true, options: [{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }, { value: "archived", label: "Archived" }] },
  ],
}];

/** Database mode edits metadata only; a replacement file is a new upload (a new version). */
const metadataSections: SectionDef[] = [{ title: "Document", fields: sections[0].fields.filter((f) => !["fileName", "sizeBytes", "mimeType"].includes(f.name)) }];

export default function DocumentLibraryPage() {
  const [editing, setEditing] = useState<DocumentFile | "new" | null>(null);
  const current = editing && editing !== "new" ? editing : undefined;
  const { can } = useAuth();
  const canUpload = !isApiMode || can("documents", "upload");

  const download = async (d: DocumentFile) => {
    try {
      await apiDownload(`/api/documents/${d.id}/download`, d.fileName);
    } catch (e) {
      toast.error("Could not download", { description: e instanceof ApiClientError ? e.message : "Something went wrong" });
    }
  };

  const columns: Column<DocumentFile>[] = [
    { key: "title", header: "Document", sortKey: "title", cell: (d) => (
      <div className="flex items-center gap-2.5"><FileText className="size-5 shrink-0 text-faint" aria-hidden /><div className="min-w-0"><span className="block truncate font-medium text-ink">{d.title}</span><span className="block truncate text-xs text-muted">{d.fileName} · {formatBytes(d.sizeBytes)}</span></div></div>
    ) },
    { key: "category", header: "Category", sortKey: "category", hideBelow: "sm", cell: (d) => d.category },
    { key: "version", header: "Version", hideBelow: "md", cell: (d) => `v${d.version}` },
    { key: "visibility", header: "Visibility", sortKey: "visibility", hideBelow: "lg", cell: (d) => <StatusBadge status={d.visibility} tone={d.visibility === "public" ? "info" : "neutral"} /> },
    { key: "status", header: "Status", sortKey: "status", cell: (d) => <StatusBadge status={d.status} /> },
    { key: "updated", header: "Updated", sortKey: "updatedAt", hideBelow: "lg", cell: (d) => <span className="text-muted">{formatDate(d.updatedAt)}</span> },
  ];

  const save = async (v: Values) => {
    const payload = {
      title: str(v.title), category: str(v.category) as DocumentFile["category"], version: str(v.version), fileName: str(v.fileName),
      mimeType: str(v.mimeType) || current?.mimeType || "application/pdf",
      sizeBytes: typeof v.sizeBytes === "number" && !Number.isNaN(v.sizeBytes) ? v.sizeBytes : current?.sizeBytes ?? 0,
      visibility: str(v.visibility) as DocumentFile["visibility"], status: str(v.status) as DocumentFile["status"], uploadedBy: current?.uploadedBy ?? "Rahul Varma",
    };
    if (current) await documentService.update(current.id, payload);
    else await documentService.create(payload);
    toast.success(current ? "Document updated" : "Document added", { description: isApiMode ? undefined : "Metadata saved to mock data; the file itself is not stored." });
    setEditing(null);
  };

  const add = canUpload ? <Button onClick={() => setEditing("new")}><Plus className="size-4" /> Add document</Button> : undefined;

  return (
    <>
      <PageHeader title="Document Library" description="Certificates, policies and brochures available for download." actions={add} />
      <ResourceList
        service={documentService} entityLabel="document" nameOf={(d) => d.title} columns={columns} selectable archivable
        defaultSort={{ by: "updatedAt", dir: "desc" }} searchPlaceholder="Search title or file name…"
        statuses={[{ value: "published" }, { value: "draft" }]} currentStatus={(d) => d.status} emptyAction={add}
        extraRowActions={(d) => [
          ...(isApiMode ? [{ label: "Download", icon: Download, hidden: !can("documents", "download"), onSelect: () => download(d) }] : []),
          { label: "Edit", icon: Pencil, hidden: isApiMode && !can("documents", "edit"), onSelect: () => setEditing(d) },
        ]}
        filters={[
          { key: "status", label: "Status", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }] },
          { key: "category", label: "Category", options: CATEGORIES.map((c) => ({ value: c, label: c })) },
          { key: "visibility", label: "Visibility", options: [{ value: "public", label: "Public" }, { value: "internal", label: "Internal" }] },
        ]}
      />
      {isApiMode && <DocumentUploadDialog open={editing === "new"} onOpenChange={(o) => !o && setEditing(null)} />}
      <EntityFormDialog
        open={isApiMode ? !!current : editing !== null} onOpenChange={(o) => !o && setEditing(null)}
        title={current ? "Edit document" : "Add document"} sections={isApiMode ? metadataSections : sections}
        defaultValues={current ? { ...current } : { title: "", category: "", version: "1.0", fileName: "", sizeBytes: NaN, mimeType: "", visibility: "public", status: "draft" }}
        submitLabel={current ? "Save changes" : "Add document"} onSubmit={save}
      />
    </>
  );
}
