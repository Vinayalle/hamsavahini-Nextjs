"use client";

import { Plus } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import type { Column } from "@/components/admin/data-table";
import { formatDate } from "@/lib/utils";
import { bannerService } from "@/lib/services";
import type { Banner } from "@/types/entities";

const SECTION: Record<Banner["section"], string> = { hero: "Hero", promo: "Promo strip", feature_strip: "Feature strip", cta: "Call to action" };

export default function BannersPage() {
  const add = <LinkButton href="/admin/banners/new"><Plus className="size-4" /> Add banner</LinkButton>;
  const columns: Column<Banner>[] = [
    { key: "title", header: "Banner", sortKey: "title", cell: (b) => (
      <div className="flex items-center gap-3">
        {b.imageUrl ? <img src={b.imageUrl} alt="" className="h-10 w-16 shrink-0 rounded border border-line object-cover" /> : <div className="h-10 w-16 shrink-0 rounded border border-dashed border-line bg-canvas" />}
        <div className="min-w-0"><span className="block max-w-sm truncate font-medium text-ink">{b.title}</span><span className="block max-w-sm truncate text-xs text-muted">{b.subtitle}</span></div>
      </div>
    ) },
    { key: "section", header: "Section", sortKey: "section", hideBelow: "md", cell: (b) => SECTION[b.section] },
    { key: "order", header: "Order", sortKey: "sortOrder", hideBelow: "sm", cell: (b) => b.sortOrder },
    { key: "schedule", header: "Schedule", hideBelow: "lg", cell: (b) => <span className="text-muted">{b.startsAt || b.endsAt ? `${formatDate(b.startsAt)} → ${formatDate(b.endsAt)}` : "Always on"}</span> },
    { key: "status", header: "Status", sortKey: "status", cell: (b) => <StatusBadge status={b.status} /> },
  ];
  return (
    <>
      <PageHeader title="Banners & Homepage Sections" description="Control hero banners, promotions and calls to action on the homepage." actions={add} />
      <ResourceList service={bannerService} entityLabel="banner" nameOf={(b) => b.title} columns={columns} selectable archivable
        defaultSort={{ by: "sortOrder", dir: "asc" }} searchPlaceholder="Search banners…"
        editHref={(b) => `/admin/banners/${b.id}/edit`}
        statuses={[{ value: "published" }, { value: "draft" }]} currentStatus={(b) => b.status} emptyAction={add}
        filters={[
          { key: "status", label: "Status", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }] },
          { key: "section", label: "Section", options: Object.entries(SECTION).map(([value, label]) => ({ value, label })) },
        ]} />
    </>
  );
}
