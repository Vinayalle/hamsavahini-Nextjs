"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import type { Column } from "@/components/admin/data-table";
import { formatDate } from "@/lib/utils";
import { commodityPriceService, commodityService, opportunityService } from "@/lib/services";
import { useAll } from "@/hooks/use-resource";
import type { Commodity } from "@/types/entities";

export default function CommoditiesPage() {
  const prices = useAll(commodityPriceService);
  const opportunities = useAll(opportunityService);
  const add = <LinkButton href="/admin/commodities/new"><Plus className="size-4" /> Add commodity</LinkButton>;
  const columns: Column<Commodity>[] = [
    { key: "name", header: "Commodity", sortKey: "name", cell: (c) => <span className="font-medium text-ink">{c.name}</span> },
    { key: "code", header: "Code", sortKey: "code", cell: (c) => <span className="font-mono text-xs text-muted">{c.code}</span> },
    { key: "group", header: "Group", sortKey: "group", hideBelow: "sm", cell: (c) => c.group },
    { key: "unit", header: "Unit", hideBelow: "md", cell: (c) => c.unit },
    { key: "prices", header: "Prices", hideBelow: "md", cell: (c) => <Link href={`/admin/commodity-prices?commodityId=${c.id}`} className="text-brand-600 hover:underline">View prices</Link> },
    { key: "status", header: "Status", sortKey: "status", cell: (c) => <StatusBadge status={c.status} /> },
    { key: "updated", header: "Updated", sortKey: "updatedAt", hideBelow: "lg", cell: (c) => <span className="text-muted">{formatDate(c.updatedAt)}</span> },
  ];
  return (
    <>
      <PageHeader title="Commodities" description="The commodity catalogue used by prices, opportunities and RFQs." actions={add} />
      <ResourceList service={commodityService} entityLabel="commodity" nameOf={(c) => c.name} columns={columns} selectable archivable
        defaultSort={{ by: "name", dir: "asc" }} searchPlaceholder="Search name, code or group…"
        editHref={(c) => `/admin/commodities/${c.id}/edit`}
        deleteGuard={(c) => {
          const p = prices.filter((x) => x.commodityId === c.id).length;
          const o = opportunities.filter((x) => x.commodityId === c.id).length;
          return p || o ? `It is still used by ${p} price entr${p === 1 ? "y" : "ies"} and ${o} opportunit${o === 1 ? "y" : "ies"}. Archive it instead.` : null;
        }}
        statuses={[{ value: "published" }, { value: "draft" }]} currentStatus={(c) => c.status} emptyAction={add}
        filters={[
          { key: "status", label: "Status", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }] },
          { key: "group", label: "Group", options: ["Energy", "Metals", "Agriculture", "Chemicals", "Minerals"].map((v) => ({ value: v, label: v })) },
        ]} />
    </>
  );
}
