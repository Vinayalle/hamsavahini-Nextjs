"use client";

import { useMemo, useRef, useState } from "react";
import { Controller, useForm, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LuImagePlus as ImagePlus, LuTrash2 as Trash2 } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Switch, Textarea } from "@/components/ui/fields";
import { Field, FormActions, FormSection, RichTextEditor, TagInput } from "./form-parts";
import { useUnsavedChangesGuard } from "@/components/admin/dialogs";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DOCUMENT_RULES, IMAGE_RULES, fileStorage, validateFile } from "@/lib/storage";
import { slugify } from "@/lib/utils";

export type FieldType =
  | "text" | "textarea" | "richtext" | "select" | "number" | "date" | "email" | "url" | "tel"
  | "switch" | "tags" | "slug" | "image" | "media-image" | "file";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Full-width in the 2-column grid. */
  wide?: boolean;
  rows?: number;
  min?: number;
  max?: number;
  maxLength?: number;
  minLength?: number;
  /** For `slug` fields: name of the field the slug is derived from while untouched. */
  slugFrom?: string;
  switchText?: [string, string];
  /** Value is set programmatically (e.g. file metadata); not rendered. */
  hidden?: boolean;
  /** Initial value for a NEW record (instead of empty). */
  defaultValue?: unknown;
  /** For `media-image` fields: the upload endpoint (returns `{ id }`) and the URL prefix that previews `<prefix>/<id>`. */
  uploadPath?: string;
  previewPath?: string;
}

export interface SectionDef {
  title: string;
  description?: string;
  fields: FieldDef[];
}

export type Values = Record<string, unknown>;

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

export function buildSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) {
    const req = f.required ? `${f.label} is required` : undefined;
    let s: z.ZodType;
    switch (f.type) {
      case "number": {
        let n = z.number({ error: f.required ? `${f.label} is required` : "Enter a number" });
        if (f.min !== undefined) n = n.min(f.min, `Must be at least ${f.min}`);
        if (f.max !== undefined) n = n.max(f.max, `Must be at most ${f.max}`);
        s = f.required ? n : z.union([n, z.nan()]);
        break;
      }
      case "switch":
        s = z.boolean();
        break;
      case "tags":
        s = z.array(z.string());
        break;
      case "email":
        s = f.required ? z.string().trim().min(1, req).email("Enter a valid email") : z.string().trim().refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email");
        break;
      case "url":
        s = z.string().trim().refine((v) => (!v && !f.required) || /^(https?:\/\/|\/(?!\/))/i.test(v), "Enter a valid URL (https://… or /path)");
        break;
      case "slug":
        s = z.string().trim().min(1, req ?? "Slug is required").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");
        break;
      case "richtext":
        s = z.string().refine((v) => !f.required || stripHtml(v).length > 0, req);
        if (f.minLength) s = (s as z.ZodString).refine((v) => !stripHtml(v) || stripHtml(v).length >= f.minLength!, `Add at least ${f.minLength} characters`);
        break;
      default: {
        let t = z.string().trim();
        if (f.required) t = t.min(1, req);
        if (f.minLength) t = t.refine((v) => !v || v.length >= f.minLength!, `Use at least ${f.minLength} characters`);
        if (f.maxLength) t = t.max(f.maxLength, `Max ${f.maxLength} characters`);
        s = t;
      }
    }
    shape[f.name] = s;
  }
  return z.object(shape);
}

/** Empty default values for every field in the given sections. */
export function defaultsFor(sections: SectionDef[]): Values {
  return Object.fromEntries(sections.flatMap((s) => s.fields).map((f) => [f.name, emptyValue(f)]));
}

/** Default (empty) value for a field type. */
export function emptyValue(f: FieldDef): unknown {
  if (f.defaultValue !== undefined) return f.defaultValue;
  if (f.type === "switch") return false;
  if (f.type === "tags") return [];
  if (f.type === "number") return f.required ? (undefined as unknown as number) : NaN;
  return "";
}

function ImageField({ value, onChange, id, label }: { value: string; onChange: (v: string) => void; id: string; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    const err = validateFile(file, IMAGE_RULES);
    if (err) return void toast.error(err);
    const stored = await fileStorage.upload(file);
    onChange(stored.url);
  };
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-canvas">
        {value ? <img src={value} alt={`${label} preview`} className="size-full object-cover" /> : <ImagePlus className="size-6 text-faint" aria-hidden />}
      </div>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => ref.current?.click()}>{value ? "Replace" : "Choose image"}</Button>
          {value && <Button variant="ghost" size="sm" onClick={() => onChange("")}><Trash2 className="size-3.5 text-danger-600" /> Remove</Button>}
        </div>
        <p className="text-xs text-faint">JPEG, PNG or WebP up to 3 MB. Local preview only; not uploaded.</p>
        <input id={id} ref={ref} type="file" hidden accept={IMAGE_RULES.accept.join(",")} aria-label={label} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}

/**
 * Database-mode picture field: the file is uploaded to the server straight away (validated there, stored inside the project) and the
 * form keeps only the returned file id. The preview comes from a permission-checked route.
 */
function MediaImageField({ value, onChange, id, label, uploadPath, previewPath, hint }: { value: string; onChange: (v: string) => void; id: string; label: string; uploadPath: string; previewPath: string; hint?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState(false);
  const pick = async (file?: File) => {
    if (!file) return;
    const err = validateFile(file, IMAGE_RULES);
    if (err) return void toast.error(err);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const asset = await apiFetch<{ id: string }>(uploadPath, { method: "POST", body: fd });
      setBroken(false);
      onChange(asset.id);
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "The image could not be uploaded");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-canvas">
        {value && !broken ? <img src={`${previewPath}/${value}`} alt={`${label} preview`} onError={() => setBroken(true)} className="size-full object-cover" /> : <ImagePlus className="size-6 text-faint" aria-hidden />}
      </div>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Uploading…" : value ? "Replace" : "Choose image"}</Button>
          {value && !busy && <Button variant="ghost" size="sm" onClick={() => onChange("")}><Trash2 className="size-3.5 text-danger-600" /> Remove</Button>}
        </div>
        <p className="text-xs text-faint">{hint ?? "JPEG, PNG or WebP up to 3 MB."}</p>
        <input id={id} ref={ref} type="file" hidden accept={IMAGE_RULES.accept.join(",")} aria-label={label} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}

function FileField({ value, onPick, id }: { value: string; onPick: (f: File) => void; id: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" size="sm" onClick={() => ref.current?.click()}>{value ? "Replace file" : "Choose file"}</Button>
      <span className="min-w-0 truncate text-sm text-muted">{value || "No file selected"}</span>
      <input id={id} ref={ref} type="file" hidden accept={DOCUMENT_RULES.accept.join(",")} aria-label="Choose file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const err = validateFile(file, DOCUMENT_RULES);
          if (err) return void toast.error(err);
          onPick(file);
        }} />
    </div>
  );
}

interface FieldsProps {
  fields: FieldDef[];
  form: ReturnType<typeof useForm<FieldValues>>;
  slugTouched: React.RefObject<Set<string>>;
}

function FieldGrid({ fields, form, slugTouched }: FieldsProps) {
  const { register, control, setValue, formState: { errors } } = form;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.filter((f) => !f.hidden).map((f) => {
        const error = errors[f.name]?.message as string | undefined;
        const wide = f.wide || ["textarea", "richtext", "tags", "image", "media-image"].includes(f.type);
        const common = { id: f.name, "aria-invalid": !!error } as const;
        let control_: React.ReactNode;
        switch (f.type) {
          case "textarea":
            control_ = <Textarea {...common} rows={f.rows ?? 3} placeholder={f.placeholder} {...register(f.name)} />;
            break;
          case "richtext":
            control_ = <Controller control={control} name={f.name} render={({ field }) => (
              <RichTextEditor id={f.name} value={(field.value as string) ?? ""} invalid={!!error} onChange={(v) => setValue(f.name, v, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })} />
            )} />;
            break;
          case "select":
            control_ = (
              <Select {...common} {...register(f.name)}>
                <option value="">{f.placeholder ?? "Select…"}</option>
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            );
            break;
          case "number":
            control_ = <Input {...common} type="number" step="any" min={f.min} max={f.max} placeholder={f.placeholder} {...register(f.name, { valueAsNumber: true })} />;
            break;
          case "switch":
            control_ = (
              <Controller control={control} name={f.name} render={({ field }) => (
                <div className="flex items-center gap-3 pt-1.5">
                  <Switch checked={!!field.value} onChange={(v) => setValue(f.name, v, { shouldDirty: true })} label={f.label} />
                  <span className="text-sm text-muted">{field.value ? f.switchText?.[0] ?? "On" : f.switchText?.[1] ?? "Off"}</span>
                </div>
              )} />
            );
            break;
          case "tags":
            control_ = <Controller control={control} name={f.name} render={({ field }) => <TagInput id={f.name} value={(field.value as string[]) ?? []} onChange={(v) => setValue(f.name, v, { shouldDirty: true })} />} />;
            break;
          case "image":
            control_ = <Controller control={control} name={f.name} render={({ field }) => <ImageField id={f.name} label={f.label} value={(field.value as string) ?? ""} onChange={(v) => setValue(f.name, v, { shouldDirty: true })} />} />;
            break;
          case "media-image":
            control_ = <Controller control={control} name={f.name} render={({ field }) => <MediaImageField id={f.name} label={f.label} uploadPath={f.uploadPath ?? ""} previewPath={f.previewPath ?? ""} hint={f.hint} value={(field.value as string) ?? ""} onChange={(v) => setValue(f.name, v, { shouldDirty: true })} />} />;
            break;
          case "file":
            control_ = <Controller control={control} name={f.name} render={({ field }) => (
              <FileField id={f.name} value={(field.value as string) ?? ""} onPick={(file) => {
                setValue(f.name, file.name, { shouldDirty: true, shouldValidate: true });
                setValue("sizeBytes", file.size, { shouldDirty: true });
                setValue("mimeType", file.type, { shouldDirty: true });
              }} />
            )} />;
            break;
          case "slug":
            control_ = <Input {...common} placeholder={f.placeholder} {...register(f.name, { onChange: () => slugTouched.current?.add(f.name) })} />;
            break;
          default: {
            const sourceOf = fields.filter((x) => x.slugFrom === f.name);
            control_ = (
              <Input
                {...common}
                type={f.type === "date" ? "date" : f.type === "tel" ? "tel" : f.type === "email" ? "email" : "text"}
                placeholder={f.placeholder}
                maxLength={f.maxLength}
                {...register(f.name, {
                  onChange: (e) => {
                    sourceOf.forEach((s) => {
                      if (!slugTouched.current?.has(s.name)) setValue(s.name, slugify(e.target.value), { shouldDirty: false });
                    });
                  },
                })}
              />
            );
          }
        }
        return (
          <Field key={f.name} label={f.label} htmlFor={f.name} required={f.required} error={error} hint={f.hint} className={wide ? "sm:col-span-2" : undefined}>
            {control_}
          </Field>
        );
      })}
    </div>
  );
}

export interface EntityFormProps {
  sections: SectionDef[];
  defaultValues: Values;
  onSubmit: (values: Values) => Promise<void> | void;
  /** Cross-field checks. Return { fieldName: message } to block saving. */
  validate?: (values: Values) => Record<string, string> | null;
  submitLabel: string;
  cancelHref?: string;
  onCancel?: () => void;
  /** Render without cards, for use inside a dialog. */
  compact?: boolean;
}

export function EntityForm({ sections, defaultValues, onSubmit, validate, submitLabel, cancelHref, onCancel, compact }: EntityFormProps) {
  const allFields = useMemo(() => sections.flatMap((s) => s.fields), [sections]);
  const schema = useMemo(() => buildSchema(allFields), [allFields]);
  const slugTouched = useRef<Set<string>>(new Set(allFields.filter((f) => f.type === "slug" && defaultValues[f.name]).map((f) => f.name)));
  const form = useForm<FieldValues>({ resolver: zodResolver(schema) as never, defaultValues });
  const { handleSubmit, setError, reset, formState: { isDirty, isSubmitting } } = form;
  const { navigate, dialog } = useUnsavedChangesGuard(isDirty && !isSubmitting && !compact);

  const submit = async (values: Values) => {
    const problems = validate?.(values);
    if (problems && Object.keys(problems).length) {
      Object.entries(problems).forEach(([k, m]) => setError(k, { message: m }));
      toast.error("Please fix the highlighted fields before saving.");
      return;
    }
    try {
      await onSubmit(values);
    } catch (e) {
      // Database-backed saves: show the server's field errors inline; anything else becomes a toast. The form stays as typed.
      if (e instanceof ApiClientError && e.fields) {
        const known = new Set(allFields.map((f) => f.name));
        const alias: Record<string, string> = { "seo.metaTitle": "seoTitle", "seo.metaDescription": "seoDescription", "seo.keywords": "seoKeywords" };
        let mapped = 0;
        for (const [k, m] of Object.entries(e.fields)) {
          const name = known.has(k) ? k : alias[k];
          if (name && known.has(name)) { setError(name, { message: m }); mapped++; }
        }
        if (mapped) return void toast.error("Please fix the highlighted fields before saving.");
      }
      toast.error(e instanceof Error ? e.message : "Could not save");
      return;
    }
    reset(values);
  };

  const cancel = () => (onCancel ? onCancel() : cancelHref && navigate(cancelHref));

  return (
    <form onSubmit={handleSubmit(submit, () => toast.error("Please fix the highlighted fields before saving."))} noValidate className={compact ? "space-y-4" : "space-y-6"}>
      {sections.map((s) =>
        compact ? (
          <FieldGrid key={s.title} fields={s.fields} form={form} slugTouched={slugTouched} />
        ) : (
          <FormSection key={s.title} title={s.title} description={s.description}>
            <FieldGrid fields={s.fields} form={form} slugTouched={slugTouched} />
          </FormSection>
        ),
      )}
      {compact ? (
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={cancel}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{submitLabel}</Button>
        </div>
      ) : (
        <FormActions>
          <Button variant="secondary" onClick={cancel}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{submitLabel}</Button>
        </FormActions>
      )}
      {dialog}
    </form>
  );
}

/** Small create/edit forms (categories, prices, users…) presented in a modal. */
export function EntityFormDialog({
  open, onOpenChange, title, description, ...form
}: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string } & Omit<EntityFormProps, "compact" | "onCancel">) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-y-auto p-6">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <div className="mt-4">
          {open && <EntityForm {...form} compact onCancel={() => onOpenChange(false)} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
