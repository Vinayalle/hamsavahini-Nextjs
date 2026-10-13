"use client";

import { LuPlus as Plus } from "react-icons/lu";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import type { Column } from "@/components/admin/data-table";
import { formatDate } from "@/lib/utils";
import { commodityService, opportunityService } from "@/lib/services";
import { useAll } from "@/hooks/use-resource";
import type { TradeOpportunity } from "@/types/entities";

export default function OpportunitiesPage() {
  const commodities = useAll(commodityService);
  const add = <LinkButton href="/admin/trade-opportunities/new"><Plus className="size-4" /> Add opportunity</LinkButton>;
  const columns: Column<TradeOpportunity>[] = [
    { key: "title", header: "Opportunity", sortKey: "title", cell: (o) => (<div className="min-w-0"><span className="block max-w-md truncate font-medium text-ink">{o.title}</span><span className="text-xs text-muted">{commodities.find((c) => c.id === o.commodityId)?.name} · {o.quantity}</span></div>) },
    { key: "type", header: "Type", sortKey: "type", hideBelow: "sm", cell: (o) => <StatusBadge status={o.type} label={o.type === "buy" ? "Buying" : "Selling"} tone={o.type === "buy" ? "info" : "purple"} /> },
    { key: "route", header: "Route", hideBelow: "lg", cell: (o) => <span className="text-muted">{o.originRegion} → {o.destinationRegion} · {o.incoterm}</span> },
    { key: "valid", header: "Valid until", sortKey: "validUntil", hideBelow: "md", cell: (o) => <span className="text-muted">{formatDate(o.validUntil)}</span> },
    { key: "status", header: "Status", sortKey: "status", cell: (o) => <StatusBadge status={o.status} /> },
  ];
  return (
    <>
      <PageHeader title="Trade Opportunities" description="Buy and sell opportunities published to registered counterparties." actions={add} />
      <ResourceList service={opportunityService} entityLabel="opportunity" nameOf={(o) => o.title} columns={columns} selectable archivable
        defaultSort={{ by: "validUntil", dir: "asc" }} searchPlaceholder="Search title or region…"
        editHref={(o) => `/admin/trade-opportunities/${o.id}/edit`}
        statuses={[{ value: "available" }, { value: "limited_availability", label: "Limited availability" }, { value: "under_negotiation", label: "Under negotiation" }, { value: "sold" }, { value: "requirement_open", label: "Requirement open" }, { value: "closed" }]} currentStatus={(o) => o.status} emptyAction={add}
        filters={[
          { key: "status", label: "Status", options: [{ value: "draft", label: "Draft" }, { value: "available", label: "Available" }, { value: "limited_availability", label: "Limited availability" }, { value: "under_negotiation", label: "Under negotiation" }, { value: "sold", label: "Sold" }, { value: "requirement_open", label: "Requirement open" }, { value: "closed", label: "Closed" }] },
          { key: "type", label: "Type", options: [{ value: "buy", label: "Buying" }, { value: "sell", label: "Selling" }] },
          { key: "category", label: "Category", options: [{ value: "available_for_sale", label: "Available for sale" }, { value: "buying_requirement", label: "Buying requirement" }, { value: "active_enquiry", label: "Active enquiry" }, { value: "spot", label: "Spot" }, { value: "long_term", label: "Long term" }, { value: "upcoming_shipment", label: "Upcoming shipment" }] },
          { key: "commodityId", label: "Commodity", options: commodities.map((c) => ({ value: c.id, label: c.name })) },
        ]} />
    </>
  );
}
