"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Star, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/fields";
import { EmptyState, PageHeader, Pagination, SearchInput } from "@/components/admin/page-parts";
import { useConfirm } from "@/components/admin/dialogs";
import { Field } from "@/components/forms/form-parts";
import { ImageUploader } from "@/components/forms/uploaders";
import { useAll } from "@/hooks/use-resource";
import { useLocalList } from "@/hooks/use-local-list";
import { productService } from "@/lib/services";
import type { ProductImage } from "@/types/entities";
import { StorageNotice } from "@/components/admin/storage-notice";
import { isApiMode } from "@/lib/api/client";

const MAX_IMAGES = 8;

function UploadDialog({ open, onOpenChange, onUploaded }: { open: boolean; onOpenChange: (o: boolean) => void; onUploaded: (productId: string) => void }) {
  const products = useAll(productService);
  const [productId, setProductId] = useState("");
  const [pending, setPending] = useState<ProductImage[]>([]);
  const [error, setError] = useState("");
  const product = products.find((p) => p.id === productId);
  const room = product ? MAX_IMAGES - product.images.length : MAX_IMAGES;

  const close = () => { setProductId(""); setPending([]); setError(""); onOpenChange(false); };

  const save = async () => {
    if (!product) return setError("Choose a product");
    if (pending.length === 0) return setError("Add at least one image");
    const hasPrimary = product.images.some((i) => i.isPrimary);
    const added = pending.map((i, idx) => ({ ...i, isPrimary: !hasPrimary && idx === 0 }));
    await productService.update(product.id, { images: [...product.images, ...added] });
    toast.success(`${added.length} image${added.length > 1 ? "s" : ""} added to ${product.name}`, { description: "Local previews only — not uploaded to storage." });
    onUploaded(product.id);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl overflow-y-auto p-6">
        <DialogTitle>Upload product images</DialogTitle>
        <DialogDescription>Choose the product, then add images. Alt text can be edited afterwards.</DialogDescription>
        <div className="mt-4 space-y-4">
          <Field label="Product" htmlFor="up-product" required error={error === "Choose a product" ? error : undefined}>
            <Select id="up-product" value={productId} onChange={(e) => { setProductId(e.target.value); setPending([]); setError(""); }}>
              <option value="">Select product…</option>
              {products.filter((p) => p.status !== "archived").map((p) => <option key={p.id} value={p.id}>{p.name} ({p.images.length}/{MAX_IMAGES} images)</option>)}
            </Select>
          </Field>
          {product && room <= 0 ? (
            <p className="rounded-lg border border-amber-200 bg-warn-50 p-3 text-sm text-warn-600">This product already has the maximum of {MAX_IMAGES} images. Remove one first.</p>
          ) : (
            <ImageUploader images={pending} onChange={setPending} max={Math.max(room, 1)} />
          )}
          {error && error !== "Choose a product" && <p className="text-sm text-danger-600" role="alert">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button onClick={() => void save()} disabled={!!product && room <= 0}>Add to product</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductImagesPage() {
  const products = useAll(productService);
  const confirm = useConfirm();
  const [productFilter, setProductFilter] = useState("all");
  const [uploading, setUploading] = useState(false);

  const items = useMemo(
    () => products
      .filter((p) => productFilter === "all" || p.id === productFilter)
      .flatMap((p) => p.images.map((img) => ({ ...img, productId: p.id, productName: p.name, code: p.code }))),
    [products, productFilter],
  );
  const list = useLocalList(items, (i) => `${i.productName} ${i.alt} ${i.code}`, 12);
  const noImages = products.filter((p) => p.images.length === 0 && p.status !== "archived");

  const setPrimary = async (productId: string, imageId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    await productService.update(productId, { images: p.images.map((i) => ({ ...i, isPrimary: i.id === imageId })) });
    toast.success("Primary image updated");
  };

  const saveAlt = async (productId: string, imageId: string, alt: string, previous: string) => {
    const text = alt.trim();
    if (text === previous) return;
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    await productService.update(productId, { images: p.images.map((i) => (i.id === imageId ? { ...i, alt: text } : i)) });
    toast.success("Alt text saved");
  };

  const remove = async (productId: string, imageId: string, alt: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    if (!(await confirm({ title: "Remove image?", description: `“${alt}” will be removed from ${p.name}.`, confirmLabel: "Remove", destructive: true }))) return;
    const left = p.images.filter((i) => i.id !== imageId);
    if (left.length && !left.some((i) => i.isPrimary)) left[0] = { ...left[0], isPrimary: true };
    await productService.update(productId, { images: left });
    toast.success("Image removed");
  };

  const upload = <Button onClick={() => setUploading(true)}><UploadCloud className="size-4" /> Upload images</Button>;

  return (
    <>
      <PageHeader title="Product Images" description="Manage every product image: upload, set the primary image, edit alt text or remove." actions={upload} />
      {isApiMode && <StorageNotice message="Product images are not connected to file storage yet, so adding or changing them is unavailable in database mode. Nothing is saved from this page." />}
      {noImages.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-warn-50 p-3 text-[13px] text-warn-600" role="status">
          {noImages.length} active product{noImages.length > 1 ? "s have" : " has"} no images: {noImages.map((p) => p.name).join(", ")}.
        </div>
      )}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row">
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search product or alt text…" className="sm:w-72" />
          <select aria-label="Product" value={productFilter} onChange={(e) => { setProductFilter(e.target.value); list.setPage(1); }}
            className="h-9 rounded-md border border-line bg-white px-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
            <option value="all">Product: All</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {list.rows.length === 0 ? (
          <EmptyState title="No images found" description="Try a different search or upload new images." action={upload} />
        ) : (
          <ul className="grid grid-cols-1 gap-4 p-4 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {list.rows.map((img) => (
              <li key={`${img.productId}-${img.id}`} className="overflow-hidden rounded-lg border border-line">
                <div className="relative aspect-[4/3] bg-canvas">
                  <img src={img.url} alt={img.alt} className="size-full object-cover" />
                  {img.isPrimary && <span className="absolute left-2 top-2 rounded bg-navy-900/85 px-1.5 py-0.5 text-[10px] font-medium text-white">Primary</span>}
                </div>
                <div className="space-y-2 p-3">
                  <Link href={`/admin/products/${img.productId}`} className="block truncate text-sm font-medium text-ink hover:text-brand-600">{img.productName}</Link>
                  <Input
                    key={`${img.id}-${img.alt}`} aria-label={`Alt text for ${img.productName} image`} defaultValue={img.alt} placeholder="Alt text" className="h-8 text-xs"
                    onBlur={(e) => void saveAlt(img.productId, img.id, e.target.value, img.alt)}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  />
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" className="flex-1" disabled={img.isPrimary} onClick={() => void setPrimary(img.productId, img.id)}><Star className="size-3.5" /> Primary</Button>
                    <Button size="sm" variant="secondary" aria-label={`Remove ${img.alt}`} onClick={() => void remove(img.productId, img.id, img.alt)}><Trash2 className="size-3.5 text-danger-600" /></Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {list.total > 0 && <Pagination page={list.page} pageCount={list.pageCount} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />}
      </Card>
      <UploadDialog open={uploading} onOpenChange={setUploading} onUploaded={(id) => { setProductFilter(id); list.setPage(1); }} />
    </>
  );
}
