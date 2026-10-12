"use client";

import { useRef, useState } from "react";
import { FileText, ImagePlus, Star, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/fields";
import { DOCUMENT_RULES, IMAGE_RULES, fileStorage, validateFile } from "@/lib/storage";
import { cn, formatBytes, uid } from "@/lib/utils";
import type { ProductDocument, ProductImage } from "@/types/entities";

const NOTE = "Previews only — files are not uploaded to any server in this build.";

/* ───────────────────────── ImageUploader ───────────────────────── */
export function ImageUploader({
  images, onChange, max = 8,
}: { images: ProductImage[]; onChange: (images: ProductImage[]) => void; max?: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const next = [...images];
    for (const file of list) {
      if (next.length >= max) {
        toast.error(`You can add up to ${max} images.`);
        break;
      }
      const error = validateFile(file, IMAGE_RULES);
      if (error) {
        toast.error(error);
        continue;
      }
      const stored = await fileStorage.upload(file);
      next.push({ id: uid("img"), url: stored.url, alt: file.name.replace(/\.[^.]+$/, ""), isPrimary: next.length === 0 });
    }
    onChange(next);
  };

  const remove = (id: string) => {
    const left = images.filter((i) => i.id !== id);
    if (left.length && !left.some((i) => i.isPrimary)) left[0] = { ...left[0], isPrimary: true };
    onChange(left);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files); }}
        className={cn("flex flex-col items-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors", dragging ? "border-brand-500 bg-brand-50" : "border-line bg-canvas/50")}
      >
        <UploadCloud className="size-7 text-faint" aria-hidden />
        <p className="mt-2 text-sm text-ink">Drag images here or</p>
        <Button variant="secondary" size="sm" className="mt-2" onClick={() => inputRef.current?.click()}>
          <ImagePlus className="size-4" /> Choose images
        </Button>
        <p className="mt-2 text-xs text-muted">JPEG, PNG or WebP · up to 3 MB each · max {max}</p>
        <input
          ref={inputRef} type="file" multiple hidden accept={IMAGE_RULES.accept.join(",")}
          aria-label="Upload images"
          onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>
      <p className="mt-2 text-xs text-faint">{NOTE}</p>

      {images.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <li key={img.id} className="overflow-hidden rounded-lg border border-line bg-white">
              <div className="relative aspect-[4/3] bg-canvas">
                <img src={img.url} alt={img.alt} className="size-full object-cover" />
                {img.isPrimary && (
                  <span className="absolute left-2 top-2 rounded bg-navy-900/85 px-1.5 py-0.5 text-[10px] font-medium text-white">Primary</span>
                )}
              </div>
              <div className="space-y-2 p-2">
                <Input
                  aria-label="Alt text" value={img.alt} placeholder="Alt text"
                  className="h-8 text-xs"
                  onChange={(e) => onChange(images.map((i) => (i.id === img.id ? { ...i, alt: e.target.value } : i)))}
                />
                <div className="flex gap-1">
                  <Button
                    variant="secondary" size="sm" className="flex-1" disabled={img.isPrimary}
                    onClick={() => onChange(images.map((i) => ({ ...i, isPrimary: i.id === img.id })))}
                  >
                    <Star className="size-3.5" /> Primary
                  </Button>
                  <Button variant="secondary" size="sm" aria-label={`Remove ${img.alt}`} onClick={() => remove(img.id)}>
                    <Trash2 className="size-3.5 text-danger-600" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────────────────────── DocumentUploader ───────────────────────── */
const DOC_TYPES: ProductDocument["type"][] = ["datasheet", "coa", "msds", "brochure", "other"];

export function DocumentUploader({
  documents, onChange,
}: { documents: ProductDocument[]; onChange: (docs: ProductDocument[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList) => {
    const next = [...documents];
    for (const file of Array.from(files)) {
      const error = validateFile(file, DOCUMENT_RULES);
      if (error) {
        toast.error(error);
        continue;
      }
      next.push({ id: uid("doc"), name: file.name, type: "other", sizeBytes: file.size });
    }
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line bg-canvas/50 px-4 py-4">
        <div>
          <p className="text-sm text-ink">Attach datasheets, certificates and brochures</p>
          <p className="text-xs text-muted">PDF, Word or Excel · up to 10 MB each</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}><UploadCloud className="size-4" /> Add files</Button>
        <input
          ref={inputRef} type="file" multiple hidden accept={DOCUMENT_RULES.accept.join(",")} aria-label="Upload documents"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>
      <p className="mt-2 text-xs text-faint">File names are recorded only; contents are not uploaded or stored in this build.</p>

      {documents.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <FileText className="size-5 shrink-0 text-faint" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{d.name}</p>
                <p className="text-xs text-muted">{formatBytes(d.sizeBytes)}</p>
              </div>
              <Select
                aria-label={`Document type for ${d.name}`} value={d.type} className="h-8 w-36 text-xs"
                onChange={(e) => onChange(documents.map((x) => (x.id === d.id ? { ...x, type: e.target.value as ProductDocument["type"] } : x)))}
              >
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t === "coa" ? "Certificate of Analysis" : t === "msds" ? "MSDS" : t[0].toUpperCase() + t.slice(1)}</option>)}
              </Select>
              <Button variant="ghost" size="icon" className="size-8" aria-label={`Remove ${d.name}`} onClick={() => onChange(documents.filter((x) => x.id !== d.id))}>
                <Trash2 className="size-4 text-danger-600" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
