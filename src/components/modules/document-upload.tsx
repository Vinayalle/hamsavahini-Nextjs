"use client";

import { useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/fields";
import { Field } from "@/components/forms/form-parts";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { DOCUMENT_RULES, validateFile } from "@/lib/storage";
import { documentService } from "@/lib/services";

export const DOCUMENT_CATEGORIES = ["Certificate", "Policy", "Brochure", "Datasheet", "Legal", "Report"] as const;

/** Database mode: uploads the real file to the server (which validates it and stores it in private object storage). */
export function DocumentUploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [v, setV] = useState({ title: "", category: "", version: "1.0", visibility: "internal", status: "draft" });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setV((s) => ({ ...s, [k]: e.target.value })); setErrors((s) => ({ ...s, [k]: "" })); };
  const reset = () => { setV({ title: "", category: "", version: "1.0", visibility: "internal", status: "draft" }); setFile(null); setErrors({}); if (fileRef.current) fileRef.current.value = ""; };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (v.title.trim().length < 2) errs.title = "Title is required";
    if (!v.category) errs.category = "Choose a category";
    if (!v.version.trim()) errs.version = "Version is required";
    if (!file) errs.file = "Choose a file";
    else { const problem = validateFile(file, DOCUMENT_RULES); if (problem) errs.file = problem; }
    setErrors(errs);
    if (Object.keys(errs).length || !file) return;
    const fd = new FormData();
    fd.set("file", file);
    for (const [k, val] of Object.entries(v)) fd.set(k, val);
    setBusy(true);
    try {
      await apiFetch("/api/documents/upload", { method: "POST", body: fd });
      await documentService.reload?.();
      toast.success("Document uploaded");
      reset();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiClientError && err.fields) setErrors(err.fields);
      toast.error(err instanceof ApiClientError ? err.message : "Upload failed. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="max-w-xl overflow-y-auto p-6" aria-describedby="doc-up-desc">
        <DialogTitle>Add document</DialogTitle>
        <DialogDescription id="doc-up-desc">PDF, Word or Excel up to 10 MB. The file is stored in private storage and checked on the server.</DialogDescription>
        <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Field label="Title" htmlFor="title" required error={errors.title} className="sm:col-span-2"><Input id="title" value={v.title} onChange={set("title")} aria-invalid={!!errors.title} /></Field>
          <Field label="Category" htmlFor="category" required error={errors.category}>
            <Select id="category" value={v.category} onChange={set("category")} aria-invalid={!!errors.category}><option value="">Select…</option>{DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
          </Field>
          <Field label="Version" htmlFor="version" required error={errors.version}><Input id="version" value={v.version} onChange={set("version")} placeholder="1.0" aria-invalid={!!errors.version} /></Field>
          <Field label="File" htmlFor="file" required error={errors.file} className="sm:col-span-2">
            <input
              ref={fileRef} id="file" type="file" accept={DOCUMENT_RULES.accept.join(",")} aria-invalid={!!errors.file}
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErrors((s) => ({ ...s, file: "" })); }}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-canvas file:px-3 file:py-1.5 file:text-sm"
            />
          </Field>
          <Field label="Visibility" htmlFor="visibility" required error={errors.visibility}>
            <Select id="visibility" value={v.visibility} onChange={set("visibility")}><option value="internal">Internal only</option><option value="public">Public (downloadable on website)</option></Select>
          </Field>
          <Field label="Status" htmlFor="status" required error={errors.status}>
            <Select id="status" value={v.status} onChange={set("status")}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></Select>
          </Field>
          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => { onOpenChange(false); reset(); }}>Cancel</Button>
            <Button type="submit" loading={busy}>Upload document</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
