"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LuPencil as Pencil, LuPlus as Plus, LuTrash2 as Trash2 } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, RowActions, type Column } from "@/components/admin/data-table";
import { EmptyState, PageHeader, Pagination, SearchInput } from "@/components/admin/page-parts";
import { StatusBadge } from "@/components/admin/status-badge";
import { useConfirm } from "@/components/admin/dialogs";
import { EntityFormDialog, type SectionDef, type Values } from "@/components/forms/entity-form";
import { useAll, useServiceReady } from "@/hooks/use-resource";
import { useLocalList } from "@/hooks/use-local-list";
import { productService } from "@/lib/services";
import { uid } from "@/lib/utils";

interface Row {
  key: string;
  productId: string;
  productName: string;
  code: string;
  status: string;
  specId: string;
  label: string;
  value: string;
  unit?: string;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

export default function SpecificationsPage() {
  const products = useAll(productService);
  const ready = useServiceReady(productService);
  const confirm = useConfirm();
  const [productFilter, setProductFilter] = useState("all");
  const [attrFilter, setAttrFilter] = useState("all");
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const current = editing && editing !== "new" ? editing : undefined;

  const allRows = useMemo<Row[]>(
    () => products.flatMap((p) => p.specifications.map((s) => ({
      key: `${p.id}-${s.id}`, productId: p.id, productName: p.name, code: p.code, status: p.status,
      specId: s.id, label: s.label, value: s.value, unit: s.unit,
    }))),
    [products],
  );
  const attributes = useMemo(() => Array.from(new Set(allRows.map((r) => r.label))).sort(), [allRows]);
  const filtered = useMemo(
    () => allRows.filter((r) => (productFilter === "all" || r.productId === productFilter) && (attrFilter === "all" || r.label === attrFilter)),
    [allRows, productFilter, attrFilter],
  );
  const list = useLocalList(filtered, (r) => `${r.productName} ${r.code} ${r.label} ${r.value}`, 12);
  const withoutSpecs = products.filter((p) => p.specifications.length === 0 && p.status !== "archived");

  const sections: SectionDef[] = [{
    title: "Specification",
    fields: [
      ...(current ? [] : [{ name: "productId", label: "Product", type: "select" as const, required: true, wide: true, options: products.filter((p) => p.status !== "archived").map((p) => ({ value: p.id, label: `${p.name} (${p.code})` })) }]),
      { name: "label", label: "Attribute", type: "text", required: true, maxLength: 60, placeholder: "Purity" },
      { name: "value", label: "Value", type: "text", required: true, maxLength: 60, placeholder: "99.7" },
      { name: "unit", label: "Unit", type: "text", maxLength: 20, placeholder: "%" },
    ],
  }];

  const save = async (v: Values) => {
    const label = str(v.label);
    const value = str(v.value);
    const unit = str(v.unit) || undefined;
    if (current) {
      const p = products.find((x) => x.id === current.productId);
      if (!p) return;
      await productService.update(p.id, { specifications: p.specifications.map((s) => (s.id === current.specId ? { ...s, label, value, unit } : s)) });
      toast.success("Specification updated");
    } else {
      const p = products.find((x) => x.id === str(v.productId));
      if (!p) return;
      await productService.update(p.id, { specifications: [...p.specifications, { id: uid("spec"), label, value, unit }] });
      toast.success("Specification added", { description: p.name });
    }
    setEditing(null);
  };

  const remove = async (r: Row) => {
    if (!(await confirm({ title: "Delete specification?", description: `“${r.label}: ${r.value}” will be removed from ${r.productName}.`, confirmLabel: "Delete", destructive: true }))) return;
    const p = products.find((x) => x.id === r.productId);
    if (!p) return;
    await productService.update(p.id, { specifications: p.specifications.filter((s) => s.id !== r.specId) });
    toast.success("Specification deleted");
  };

  const columns: Column<Row>[] = [
    { key: "product", header: "Product", cell: (r) => (<div><Link href={`/admin/products/${r.productId}`} className="font-medium text-ink hover:text-brand-600">{r.productName}</Link><span className="block font-mono text-xs text-muted">{r.code}</span></div>) },
    { key: "label", header: "Attribute", cell: (r) => r.label },
    { key: "value", header: "Value", cell: (r) => <span className="font-medium">{r.value}{r.unit ? ` ${r.unit}` : ""}</span> },
    { key: "status", header: "Product status", hideBelow: "md", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  const selectCls = "h-9 rounded-md border border-line bg-white px-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
  const add = <Button onClick={() => setEditing("new")}><Plus className="size-4" /> Add specification</Button>;

  return (
    <>
      <PageHeader title="Product Specifications" description="Manage technical attributes across the whole catalogue." actions={add} />
      {withoutSpecs.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-warn-50 p-3 text-[13px] text-warn-600" role="status">
          {withoutSpecs.length} active product{withoutSpecs.length > 1 ? "s have" : " has"} no specifications:{" "}
          {withoutSpecs.map((p, i) => (<span key={p.id}>{i > 0 && ", "}<Link href={`/admin/products/${p.id}/edit`} className="font-medium underline">{p.name}</Link></span>))}
        </div>
      )}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line p-4 lg:flex-row lg:items-center">
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search product, attribute or value…" className="lg:w-80" />
          <select aria-label="Product" value={productFilter} className={selectCls} onChange={(e) => { setProductFilter(e.target.value); list.setPage(1); }}>
            <option value="all">Product: All</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select aria-label="Attribute" value={attrFilter} className={selectCls} onChange={(e) => { setAttrFilter(e.target.value); list.setPage(1); }}>
            <option value="all">Attribute: All</option>
            {attributes.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {(productFilter !== "all" || attrFilter !== "all" || list.search) && (
            <Button variant="ghost" size="sm" onClick={() => { setProductFilter("all"); setAttrFilter("all"); list.reset(); }}>Reset</Button>
          )}
        </div>
        <DataTable
          caption="Specifications" columns={columns} rows={list.rows} rowKey={(r) => r.key} loading={!ready}
          rowActions={(r) => (
            <RowActions label={`Actions for ${r.productName} ${r.label}`} items={[
              { label: "Edit", icon: Pencil, onSelect: () => setEditing(r) },
              { label: "Delete", icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => remove(r) },
            ]} />
          )}
          empty={<EmptyState title="No specifications found" description={list.search || productFilter !== "all" || attrFilter !== "all" ? "Try different filters." : "Add the first specification."} action={add} />}
        />
        {list.total > 0 && <Pagination page={list.page} pageCount={list.pageCount} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />}
      </Card>

      <EntityFormDialog
        open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}
        title={current ? `Edit specification` : "Add specification"}
        description={current ? `${current.productName} · ${current.code}` : undefined}
        sections={sections}
        defaultValues={current ? { label: current.label, value: current.value, unit: current.unit ?? "" } : { productId: "", label: "", value: "", unit: "" }}
        validate={(v) => {
          const pid = current?.productId ?? str(v.productId);
          const dup = products.find((p) => p.id === pid)?.specifications.some((s) => s.id !== current?.specId && s.label.trim().toLowerCase() === str(v.label).trim().toLowerCase());
          return dup ? { label: "This product already has that attribute" } : null;
        }}
        submitLabel={current ? "Save changes" : "Add specification"} onSubmit={save}
      />
    </>
  );
}
