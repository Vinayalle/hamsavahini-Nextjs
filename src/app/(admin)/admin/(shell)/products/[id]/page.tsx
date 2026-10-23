"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LuArchive as Archive, LuFileText as FileText, LuPencil as Pencil, LuStar as Star, LuTrash2 as Trash2 } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { NotFoundRecord, PageHeader } from "@/components/admin/page-parts";
import { StatusBadge } from "@/components/admin/status-badge";
import { DetailList } from "@/components/admin/detail-parts";
import { useConfirm } from "@/components/admin/dialogs";
import { useBreadcrumbLabel } from "@/components/admin/use-breadcrumb-label";
import { useAll, useEntityHistory, useRecord } from "@/hooks/use-resource";
import { categoryService, productService } from "@/lib/services";
import { formatBytes, formatDate } from "@/lib/utils";
import { ActivityTimeline } from "@/components/admin/detail-parts";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const product = useRecord(productService, id);
  const categories = useAll(categoryService);
  const historyEntries = useEntityHistory("Product", product?.name);
  const [activeImage, setActiveImage] = useState(0);
  useBreadcrumbLabel(product?.name);

  if (!product) return <NotFoundRecord what="Product" backHref="/admin/products" backLabel="Back to products" service={productService} />;

  const category = categories.find((c) => c.id === product.categoryId)?.name;
  const image = product.images[activeImage] ?? product.images[0];
  const history = historyEntries
    .map((a) => ({ id: a.id, title: `${a.action.replace("_", " ")} by ${a.actor}`, meta: a.detail, at: a.createdAt }));

  const changeStatus = async (status: string) => {
    if (!(await confirm({ title: `Mark product as ${status}?`, description: `“${product.name}” will be ${status === "published" ? "visible on" : "hidden from"} the website.`, confirmLabel: "Confirm" }))) return;
    await productService.setStatus(product.id, status);
    toast.success(`Status updated to ${status}`);
  };
  const archive = async () => {
    if (!(await confirm({ title: "Archive product?", description: `“${product.name}” will be hidden from the website.`, confirmLabel: "Archive" }))) return;
    await productService.archive(product.id);
    toast.success("Product archived");
  };
  const remove = async () => {
    if (!(await confirm({ title: "Delete product?", description: `“${product.name}” will be permanently deleted. This cannot be undone.`, confirmLabel: "Delete", destructive: true }))) return;
    await productService.remove(product.id);
    toast.success("Product deleted");
    router.replace("/admin/products");
  };

  return (
    <>
      <PageHeader
        title={product.name}
        description={`${product.code} · ${category ?? "Uncategorised"}`}
        actions={
          <>
            {product.status !== "published" && <Button variant="secondary" onClick={() => changeStatus("published")}>Publish</Button>}
            {product.status === "published" && <Button variant="secondary" onClick={() => changeStatus("draft")}>Unpublish</Button>}
            {product.status !== "archived" && <Button variant="secondary" onClick={() => archive()}><Archive className="size-4" /> Archive</Button>}
            <Button variant="secondary" onClick={() => remove()}><Trash2 className="size-4 text-danger-600" /> Delete</Button>
            <LinkButton href={`/admin/products/${product.id}/edit`}><Pencil className="size-4" /> Edit</LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="grid gap-4 p-5 sm:grid-cols-[1fr_9rem]">
              <div className="aspect-[4/3] overflow-hidden rounded-lg border border-line bg-canvas">
                { }
                {image ? <img src={image.url} alt={image.alt} className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-sm text-muted">No images</div>}
              </div>
              <ul className="flex gap-2 sm:flex-col">
                {product.images.map((img, i) => (
                  <li key={img.id}>
                    <button type="button" onClick={() => setActiveImage(i)} aria-label={`Show image ${i + 1}`} className={`block overflow-hidden rounded-md border-2 ${i === activeImage ? "border-brand-500" : "border-line"}`}>
                      { }
                      <img src={img.url} alt={img.alt} className="h-16 w-24 object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader title="Description" />
            <div className="space-y-3 p-5 text-sm leading-relaxed text-ink">
              <p className="font-medium">{product.shortDescription}</p>
              {product.description.split("\n\n").map((para, i) => <p key={i} className="text-muted">{para}</p>)}
            </div>
          </Card>

          <Card>
            <CardHeader title="Specifications" />
            {product.specifications.length === 0 ? (
              <p className="p-5 text-sm text-muted">No specifications added.</p>
            ) : (
              <dl className="divide-y divide-line">
                {product.specifications.map((s) => (
                  <div key={s.id} className="grid grid-cols-2 gap-4 px-5 py-2.5 text-sm">
                    <dt className="text-muted">{s.label}</dt>
                    <dd className="font-medium text-ink">{s.value}{s.unit ? ` ${s.unit}` : ""}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>

          <Card>
            <CardHeader title="Documents" />
            {product.documents.length === 0 ? (
              <p className="p-5 text-sm text-muted">No documents attached.</p>
            ) : (
              <ul className="divide-y divide-line">
                {product.documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <FileText className="size-5 text-faint" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{d.name}</span>
                    <span className="text-xs uppercase text-muted">{d.type}</span>
                    <span className="text-xs text-muted">{formatBytes(d.sizeBytes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Publishing" />
            <div className="space-y-4 p-5">
              <DetailList items={[
                { label: "Status", value: <StatusBadge status={product.status} /> },
                { label: "Featured", value: product.featured ? <span className="inline-flex items-center gap-1"><Star className="size-4 fill-amber-400 text-amber-400" /> Yes</span> : "No" },
                { label: "Published", value: formatDate(product.publishedAt) },
                { label: "Last updated", value: formatDate(product.updatedAt, true) },
                { label: "Created", value: formatDate(product.createdAt) },
                { label: "Slug", value: <code className="text-xs">{product.slug}</code> },
              ]} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Change history (this session)" />
            <ActivityTimeline entries={history} empty="No changes recorded in this session." />
          </Card>
        </div>
      </div>
    </>
  );
}
