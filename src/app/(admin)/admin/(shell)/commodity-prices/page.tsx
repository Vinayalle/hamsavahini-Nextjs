"use client";

import { useState } from "react";
import { LuInfo as Info, LuPencil as Pencil, LuPlus as Plus } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import type { Column } from "@/components/admin/data-table";
import { EntityFormDialog, type SectionDef, type Values } from "@/components/forms/entity-form";
import { useAll } from "@/hooks/use-resource";
import { commodityPriceService, commodityService } from "@/lib/services";
import { formatDate } from "@/lib/utils";
import type { CommodityPrice } from "@/types/entities";

const str = (v: unknown) => (typeof v === "string" ? v : "");

export default function CommodityPricesPage() {
  const commodities = useAll(commodityService);
  const [editing, setEditing] = useState<CommodityPrice | "new" | null>(null);
  const current = editing && editing !== "new" ? editing : undefined;
  const name = (id: string) => commodities.find((c) => c.id === id)?.name ?? "—";

  const sections: SectionDef[] = [{
    title: "Price entry",
    fields: [
      { name: "commodityId", label: "Commodity", type: "select", required: true, options: commodities.map((c) => ({ value: c.id, label: c.name })) },
      { name: "effectiveDate", label: "Effective date", type: "date", required: true },
      { name: "price", label: "Price", type: "number", required: true, min: 0.01 },
      { name: "currency", label: "Currency", type: "select", required: true, options: ["USD", "EUR", "INR", "AED", "CNY"].map((v) => ({ value: v, label: v })) },
      { name: "unit", label: "Unit", type: "select", required: true, options: ["MT", "DMT", "kg", "barrel"].map((v) => ({ value: v, label: v })) },
      { name: "market", label: "Market / benchmark", type: "text", required: true, placeholder: "LME official, Cash" },
      { name: "status", label: "Status", type: "select", required: true, options: [{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }] },
    ],
  }];

  const columns: Column<CommodityPrice>[] = [
    { key: "commodity", header: "Commodity", cell: (p) => <span className="font-medium text-ink">{name(p.commodityId)}</span> },
    { key: "price", header: "Price", sortKey: "price", cell: (p) => <span className="tabular-nums">{p.currency} {p.price.toLocaleString("en-US")} / {p.unit}</span> },
    { key: "market", header: "Market", hideBelow: "md", cell: (p) => <span className="text-muted">{p.market}</span> },
    { key: "date", header: "Effective", sortKey: "effectiveDate", cell: (p) => formatDate(p.effectiveDate) },
    { key: "status", header: "Status", sortKey: "status", cell: (p) => <StatusBadge status={p.status} /> },
  ];

  const save = async (v: Values) => {
    const payload = {
      commodityId: str(v.commodityId), price: v.price as number, currency: str(v.currency) as CommodityPrice["currency"],
      unit: str(v.unit), market: str(v.market), effectiveDate: str(v.effectiveDate), status: str(v.status) as CommodityPrice["status"],
    };
    if (current) await commodityPriceService.update(current.id, payload);
    else await commodityPriceService.create(payload);
    toast.success(current ? "Price updated" : "Price added");
    setEditing(null);
  };

  const add = <Button onClick={() => setEditing("new")}><Plus className="size-4" /> Add price</Button>;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title="Commodity Prices" description="Reference prices published on the website." actions={add} />
      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-brand-200 bg-brand-50 p-3 text-[13px] text-brand-700">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>Prices are entered manually by editors. No live market feed is connected, so always cite the benchmark in the Market field.</p>
      </div>
      <ResourceList
        service={commodityPriceService} entityLabel="price" nameOf={(p) => `${name(p.commodityId)} ${p.effectiveDate}`}
        columns={columns} selectable defaultSort={{ by: "effectiveDate", dir: "desc" }} searchPlaceholder="Search market or currency…"
        statuses={[{ value: "published" }, { value: "draft" }]} currentStatus={(p) => p.status} emptyAction={add}
        extraRowActions={(p) => [{ label: "Edit", icon: Pencil, onSelect: () => setEditing(p) }]}
        filters={[
          { key: "commodityId", label: "Commodity", options: commodities.map((c) => ({ value: c.id, label: c.name })) },
          { key: "status", label: "Status", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }] },
        ]}
      />
      <EntityFormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={current ? "Edit price" : "Add price"}
        sections={sections}
        defaultValues={current ? { ...current } : { commodityId: "", effectiveDate: today, price: undefined, currency: "USD", unit: "MT", market: "", status: "draft" }}
        validate={(v) => {
          const out: Record<string, string> = {};
          if (str(v.effectiveDate) > today) out.effectiveDate = "Effective date cannot be in the future";
          const dup = commodityPriceService.snapshot().some((p) => p.id !== current?.id && p.commodityId === v.commodityId && p.effectiveDate === v.effectiveDate && p.market.trim().toLowerCase() === str(v.market).trim().toLowerCase());
          if (dup) out.market = "A price for this commodity, market and date already exists";
          return out;
        }}
        submitLabel={current ? "Save changes" : "Add price"}
        onSubmit={save}
      />
    </>
  );
}
