"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui/fields";
import { DataTable, type Column } from "@/components/admin/data-table";
import { EmptyState, PageHeader, Pagination, SearchInput } from "@/components/admin/page-parts";
import { useConfirm } from "@/components/admin/dialogs";
import { Field } from "@/components/forms/form-parts";
import { DocumentUploader } from "@/components/forms/uploaders";
import { useAll } from "@/hooks/use-resource";
import { useLocalList } from "@/hooks/use-local-list";
import { productService } from "@/lib/services";
import { formatBytes } from "@/lib/utils";
import type { ProductDocument } from "@/types/entities";
import { StorageNotice } from "@/components/admin/storage-notice";
import { isApiMode } from "@/lib/api/client";

const TYPE_LABEL: Record<ProductDocument["type"], string> = { datasheet: "Datasheet", coa: "Certificate of Analysis", msds: "MSDS", brochure: "Brochure", other: "Other" };

interface Row { key: string; productId: string; productName: string; docId: string; name: string; type: ProductDocument["type"]; sizeBytes: number }

function AddDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; onAdded: (productId: string) => void }) {
  const products = useAll(productService);
  const [productId, setProductId] = useState("");
  const [pending, setPending] = useState<ProductDocument[]>([]);
  const [error, setError] = useState("");

  const close = () => { setProductId(""); setPending([]); setError(""); onOpenChange(false); };

  const save = async () => {
    const product = products.find((p) => p.id === productId);
    if (!product) return setError("Choose a product");
    if (pending.length === 0) return setError("Add at least one document");
    const existing = new Set(product.documents.map((d) => d.name.toLowerCase()));
    const fresh = pending.filter((d) => !existing.has(d.name.toLowerCase()));
    if (fresh.length < pending.length) toast.warning("Skipped files already attached to this product");
    if (fresh.length === 0) return setError("These files are already attached");
    await productService.update(product.id, { documents: [...product.documents, ...fresh] });
    toast.success(`${fresh.length} document${fresh.length > 1 ? "s" : ""} attached to ${product.name}`, { description: "File names recorded only — contents are not stored." });
    onAdded(product.id);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl overflow-y-auto p-6">
        <DialogTitle>Attach product documents</DialogTitle>
        <DialogDescription>Choose the product, add files, and set each document&apos;s type.</DialogDescription>
        <div className="mt-4 space-y-4">
          <Field label="Product" htmlFor="doc-product" required error={error === "Choose a product" ? error : undefined}>
            <Select id="doc-product" value={productId} onChange={(e) => { setProductId(e.target.value); setError(""); }}>
              <option value="">Select product…</option>
              {products.filter((p) => p.status !== "archived").map((p) => <option key={p.id} value={p.id}>{p.name} ({p.documents.length} docs)</option>)}
            </Select>
          </Field>
          <DocumentUploader documents={pending} onChange={setPending} />
          {error && error !== "Choose a product" && <p className="text-sm text-danger-600" role="alert">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button onClick={() => void save()}>Attach to product</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductDocumentsPage() {
  const products = useAll(productService);
  const confirm = useConfirm();
  const [type, setType] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [adding, setAdding] = useState(false);

  const rows = useMemo<Row[]>(
    () => products
      .filter((p) => productFilter === "all" || p.id === productFilter)
      .flatMap((p) => p.documents.map((d) => ({ key: `${p.id}-${d.id}`, productId: p.id, productName: p.name, docId: d.id, name: d.name, type: d.type, sizeBytes: d.sizeBytes })))
      .filter((r) => type === "all" || r.type === type),
    [products, type, productFilter],
  );
  const list = useLocalList(rows, (r) => `${r.productName} ${r.name}`, 10);

  const changeType = async (r: Row, next: ProductDocument["type"]) => {
    const p = products.find((x) => x.id === r.productId);
    if (!p) return;
    await productService.update(p.id, { documents: p.documents.map((d) => (d.id === r.docId ? { ...d, type: next } : d)) });
    toast.success(`Marked as ${TYPE_LABEL[next]}`);
  };

  const remove = async (r: Row) => {
    if (!(await confirm({ title: "Remove document?", description: `“${r.name}” will be detached from ${r.productName}.`, confirmLabel: "Remove", destructive: true }))) return;
    const p = products.find((x) => x.id === r.productId);
    if (!p) return;
    await productService.update(p.id, { documents: p.documents.filter((d) => d.id !== r.docId) });
    toast.success("Document removed");
  };

  const columns: Column<Row>[] = [
    { key: "name", header: "Document", cell: (r) => (<div className="flex items-center gap-2.5"><FileText className="size-5 shrink-0 text-faint" aria-hidden /><span className="truncate font-medium text-ink">{r.name}</span></div>) },
    { key: "type", header: "Type", cell: (r) => (
      <Select aria-label={`Type of ${r.name}`} value={r.type} className="h-8 w-44 text-xs" onChange={(e) => void changeType(r, e.target.value as ProductDocument["type"])}>
        {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
    ) },
    { key: "product", header: "Product", hideBelow: "sm", cell: (r) => <Link href={`/admin/products/${r.productId}`} className="text-brand-600 hover:underline">{r.productName}</Link> },
    { key: "size", header: "Size", hideBelow: "md", cell: (r) => <span className="text-muted">{formatBytes(r.sizeBytes)}</span> },
    { key: "actions", header: "", className: "text-right", cell: (r) => (
      <Button variant="ghost" size="sm" aria-label={`Remove ${r.name}`} onClick={() => void remove(r)}><Trash2 className="size-3.5 text-danger-600" /></Button>
    ) },
  ];

  const add = <Button onClick={() => setAdding(true)}><Plus className="size-4" /> Attach documents</Button>;
  const selectCls = "h-9 rounded-md border border-line bg-white px-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

  return (
    <>
      <PageHeader title="Product Documents" description="Datasheets, certificates and brochures attached to products." actions={add} />
      {isApiMode && <StorageNotice message="Product documents are not connected to file storage yet, so attaching them is unavailable in database mode. Nothing is saved from this page." />}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-4 lg:flex-row">
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search document or product…" className="lg:w-72" />
          <select aria-label="Product" value={productFilter} className={selectCls} onChange={(e) => { setProductFilter(e.target.value); list.setPage(1); }}>
            <option value="all">Product: All</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select aria-label="Document type" value={type} className={selectCls} onChange={(e) => { setType(e.target.value); list.setPage(1); }}>
            <option value="all">Type: All</option>
            {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <DataTable caption="Product documents" columns={columns} rows={list.rows} rowKey={(r) => r.key}
          empty={<EmptyState title="No documents found" description="Try different filters or attach a document." action={add} />} />
        {list.total > 0 && <Pagination page={list.page} pageCount={list.pageCount} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />}
      </Card>
      <AddDialog open={adding} onOpenChange={setAdding} onAdded={(id) => { setProductFilter(id); setType("all"); list.setPage(1); }} />
    </>
  );
}
