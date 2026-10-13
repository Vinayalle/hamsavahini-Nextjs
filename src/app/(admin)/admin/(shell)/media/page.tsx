"use client";

import { useRef, useState } from "react";
import { LuCopy as Copy, LuFileVideo as FileVideo, LuTrash2 as Trash2, LuCloudUpload as UploadCloud } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/fields";
import { EmptyState, FilterBar, PageHeader, Pagination } from "@/components/admin/page-parts";
import { DetailDrawer, DetailList } from "@/components/admin/detail-parts";
import { useConfirm } from "@/components/admin/dialogs";
import { useAll, useRecord, useResource, useServiceReady } from "@/hooks/use-resource";
import { StorageNotice, useStorageConfigured } from "@/components/admin/storage-notice";
import { ApiClientError, apiFetch, isApiMode } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { mediaService } from "@/lib/services";
import { IMAGE_RULES, fileStorage, validateFile } from "@/lib/storage";
import { formatBytes, formatDate } from "@/lib/utils";
import { ImageGridSkeleton } from "@/components/admin/skeletons";

const FOLDERS = ["Banners", "Locations", "Posts", "Products", "Projects", "Brand", "Uploads"];

export default function MediaLibraryPage() {
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const all = useAll(mediaService);
  const ready = useServiceReady(mediaService);
  const data = useResource(mediaService, { search, page, pageSize: 12, filters, sortBy: "createdAt", sortDir: "desc" });
  const asset = useRecord(mediaService, openId ?? "");
  const [alt, setAlt] = useState<{ id: string; text: string } | null>(null);

  const { can } = useAuth();
  const storage = useStorageConfigured();
  const allow = (action: string) => !isApiMode || can("media", action);
  const canUpload = !isApiMode || (storage === true && can("media", "upload"));

  const upload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/");
      const err = isVideo ? (file.size > 50 * 1024 * 1024 ? `“${file.name}” exceeds the 50 MB limit.` : null) : validateFile(file, IMAGE_RULES);
      if (err) { toast.error(err); continue; }
      if (isApiMode) {
        // Real upload: the server checks the file content, stores it in private storage and only then reports success.
        const fd = new FormData();
        fd.set("file", file);
        try {
          await apiFetch("/api/media/upload", { method: "POST", body: fd });
          await mediaService.reload?.();
          toast.success(`${file.name} uploaded`);
        } catch (e) {
          toast.error(`${file.name} was not uploaded`, { description: e instanceof ApiClientError ? e.message : "Something went wrong. Nothing was saved." });
        }
        continue;
      }
      const stored = await fileStorage.upload(file);
      await mediaService.create({
        name: file.name, kind: isVideo ? "video" : "image", mimeType: file.type, sizeBytes: file.size, url: stored.url,
        altText: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "), uploadedBy: "Rahul Varma", folder: "Uploads",
      });
      toast.success(`${file.name} added`, { description: "Local preview only — not uploaded to storage." });
    }
  };

  const remove = async () => {
    if (!asset) return;
    if (!(await confirm({ title: "Delete media file?", description: `“${asset.name}” will be removed from the library. Pages that use it may show a broken image.`, confirmLabel: "Delete", destructive: true }))) return;
    try {
      await mediaService.remove(asset.id);
      setOpenId(null);
      toast.success("Media deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  };

  const saveAlt = async () => {
    if (!alt) return;
    try {
      await mediaService.update(alt.id, { altText: alt.text });
      setAlt(null);
      toast.success("Alt text saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  };

  return (
    <>
      <PageHeader
        title="Media Library"
        description="Images and video used across the website."
        actions={canUpload ? <Button onClick={() => inputRef.current?.click()}><UploadCloud className="size-4" /> Upload media</Button> : undefined}
      />
      {isApiMode && storage === false && <StorageNotice what="Media" />}
      <input ref={inputRef} type="file" multiple hidden accept={[...IMAGE_RULES.accept, "video/mp4"].join(",")} aria-label="Upload media" onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ""; }} />

      <Card className="overflow-hidden">
        <FilterBar
          search={search} onSearch={(v) => { setSearch(v); setPage(1); }} searchPlaceholder="Search file name or alt text…"
          filters={[
            { key: "kind", label: "Type", options: [{ value: "image", label: "Images" }, { value: "video", label: "Video" }] },
            { key: "folder", label: "Folder", options: FOLDERS.map((f) => ({ value: f, label: f })) },
          ]}
          values={filters} onChange={(k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); }}
          onReset={() => { setSearch(""); setFilters({}); setPage(1); }}
        />
        {!ready ? (
          <ImageGridSkeleton />
        ) : data.items.length === 0 ? (
          <EmptyState title="No media found" description={all.length ? "Try a different search or filter." : "Upload your first file."} />
        ) : (
          <ul className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {data.items.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => setOpenId(m.id)} className="group block w-full overflow-hidden rounded-lg border border-line text-left transition-colors hover:border-brand-200">
                  <div className="relative aspect-square bg-canvas">
                    <img src={m.url} alt={m.altText} className="size-full object-cover" />
                    {m.kind === "video" && <span className="absolute inset-0 flex items-center justify-center bg-navy-950/30 text-white"><FileVideo className="size-8" aria-hidden /></span>}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-medium text-ink">{m.name}</p>
                    <p className="text-[11px] text-muted">{formatBytes(m.sizeBytes)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {data.total > 0 && <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
      </Card>

      <DetailDrawer
        open={!!asset} onOpenChange={(o) => !o && setOpenId(null)} title={asset?.name ?? ""} description={asset ? `${asset.folder} · ${formatBytes(asset.sizeBytes)}` : undefined}
        footer={asset && allow("delete") && <Button variant="secondary" onClick={() => remove()}><Trash2 className="size-4 text-danger-600" /> Delete</Button>}
      >
        {asset && (
          <div className="space-y-6">
            <div className="overflow-hidden rounded-lg border border-line bg-canvas">
              <img src={asset.url} alt={asset.altText} className="max-h-72 w-full object-contain" />
            </div>
            <div>
              <Label htmlFor="alt">Alt text</Label>
              <div className="flex gap-2">
                <Input id="alt" value={alt?.id === asset.id ? alt.text : asset.altText} disabled={!allow("edit")} onChange={(e) => setAlt({ id: asset.id, text: e.target.value })} />
                <Button disabled={!allow("edit") || alt?.id !== asset.id || alt.text === asset.altText} onClick={() => saveAlt()}>Save</Button>
              </div>
              <p className="mt-1 text-xs text-muted">Describe the image for screen readers and SEO.</p>
            </div>
            <DetailList items={[
              { label: "File name", value: asset.name },
              { label: "Type", value: asset.mimeType },
              { label: "Dimensions", value: asset.width && asset.height ? `${asset.width} × ${asset.height}px` : undefined },
              { label: "Size", value: formatBytes(asset.sizeBytes) },
              { label: "Folder", value: asset.folder },
              { label: "Uploaded by", value: asset.uploadedBy },
              { label: "Added", value: formatDate(asset.createdAt, true) },
            ]} />
            <Button variant="secondary" onClick={() => { void navigator.clipboard?.writeText(asset.url.startsWith("data:") ? asset.name : asset.url); toast.success("Copied"); }}>
              <Copy className="size-4" /> Copy file reference
            </Button>
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
