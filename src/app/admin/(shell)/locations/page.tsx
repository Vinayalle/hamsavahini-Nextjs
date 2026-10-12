"use client";

import { Plus } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import type { Column } from "@/components/admin/data-table";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Switch } from "@/components/ui/fields";
import { locationService } from "@/lib/services";
import type { Location } from "@/types/entities";

const TYPE: Record<Location["type"], string> = {
  headquarters: "Headquarters", regional_office: "Regional office", mine: "Mine", sourcing_location: "Sourcing location", supplier: "Supplier", processing_facility: "Processing facility",
  warehouse: "Warehouse", port_terminal: "Port / terminal", market: "Market", trading_destination: "Trading destination", representative: "Representative office",
};

export default function LocationsPage() {
  const add = <LinkButton href="/admin/locations/new"><Plus className="size-4" /> Add location</LinkButton>;
  const columns: Column<Location>[] = [
    { key: "name", header: "Location", sortKey: "name", cell: (l) => (<div className="min-w-0"><span className="block truncate font-medium text-ink">{l.name}</span><span className="text-xs text-muted">{l.city}, {l.country}</span></div>) },
    { key: "type", header: "Type", sortKey: "type", hideBelow: "md", cell: (l) => TYPE[l.type] },
    { key: "address", header: "Address", hideBelow: "lg", cell: (l) => <span className="line-clamp-1 max-w-xs text-muted">{l.address}</span> },
    { key: "active", header: "On website", sortKey: "active", cell: (l) => (
      <Switch checked={l.active} label={`Show ${l.name} on website`} onChange={async (v) => { await locationService.update(l.id, { active: v }); toast.success(v ? "Location is now visible" : "Location hidden from website"); }} />
    ) },
    { key: "updated", header: "Updated", sortKey: "updatedAt", hideBelow: "lg", cell: (l) => <span className="text-muted">{formatDate(l.updatedAt)}</span> },
  ];
  return (
    <>
      <PageHeader title="Global Operations / Locations" description="Offices, terminals and warehouses displayed on the website." actions={add} />
      <ResourceList service={locationService} entityLabel="location" nameOf={(l) => l.name} columns={columns} selectable
        defaultSort={{ by: "name", dir: "asc" }} searchPlaceholder="Search name, city or country…"
        editHref={(l) => `/admin/locations/${l.id}/edit`} emptyAction={add}
        filters={[
          { key: "type", label: "Type", options: Object.entries(TYPE).map(([value, label]) => ({ value, label })) },
          { key: "active", label: "Visibility", options: [{ value: "true", label: "Active" }, { value: "false", label: "Hidden" }] },
        ]} />
    </>
  );
}
