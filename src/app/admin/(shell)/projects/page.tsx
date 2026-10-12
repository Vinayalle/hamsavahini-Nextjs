"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import type { Column } from "@/components/admin/data-table";
import { formatDate } from "@/lib/utils";
import { projectService } from "@/lib/services";
import type { Project } from "@/types/entities";

const columns: Column<Project>[] = [
  { key: "title", header: "Project", sortKey: "title", cell: (p) => (<div className="min-w-0"><Link href={`/admin/projects/${p.id}`} className="block max-w-md truncate font-medium text-ink hover:text-brand-600">{p.title}</Link><span className="text-xs text-muted">{p.client}</span></div>) },
  { key: "commodity", header: "Commodity", sortKey: "commodity", hideBelow: "md", cell: (p) => p.commodity },
  { key: "region", header: "Region", hideBelow: "lg", cell: (p) => p.region },
  { key: "stage", header: "Stage", sortKey: "projectStatus", cell: (p) => <StatusBadge status={p.projectStatus} /> },
  { key: "status", header: "Visibility", sortKey: "status", hideBelow: "sm", cell: (p) => <StatusBadge status={p.status} /> },
  { key: "updated", header: "Updated", sortKey: "updatedAt", hideBelow: "lg", cell: (p) => <span className="text-muted">{formatDate(p.updatedAt)}</span> },
];

export default function ProjectsPage() {
  const add = <LinkButton href="/admin/projects/new"><Plus className="size-4" /> Add project</LinkButton>;
  return (
    <>
      <PageHeader title="Projects / Trade Stories" description="Case studies and trade stories showcased on the website." actions={add} />
      <ResourceList service={projectService} entityLabel="project" nameOf={(p) => p.title} columns={columns} selectable archivable
        defaultSort={{ by: "updatedAt", dir: "desc" }} searchPlaceholder="Search project, client or region…"
        viewHref={(p) => `/admin/projects/${p.id}`} editHref={(p) => `/admin/projects/${p.id}/edit`}
        statuses={[{ value: "published" }, { value: "draft" }]} currentStatus={(p) => p.status} emptyAction={add}
        filters={[
          { key: "status", label: "Status", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }] },
          { key: "projectStatus", label: "Stage", options: [{ value: "planning", label: "Planning" }, { value: "active", label: "Active" }, { value: "completed", label: "Completed" }, { value: "on_hold", label: "On hold" }] },
          { key: "featured", label: "Featured", options: [{ value: "true", label: "Featured" }, { value: "false", label: "Not featured" }] },
        ]} />
    </>
  );
}
