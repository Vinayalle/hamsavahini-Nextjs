"use client";

import Link from "next/link";
import { LuPlus as Plus } from "react-icons/lu";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import type { Column } from "@/components/admin/data-table";
import { formatDate } from "@/lib/utils";
import { applicationService, careerService } from "@/lib/services";
import { useAll } from "@/hooks/use-resource";
import type { Career } from "@/types/entities";

const TYPE: Record<Career["employmentType"], string> = { full_time: "Full time", part_time: "Part time", contract: "Contract", internship: "Internship" };

export default function CareersPage() {
  const apps = useAll(applicationService);
  const add = <LinkButton href="/admin/careers/new"><Plus className="size-4" /> Add opening</LinkButton>;
  const columns: Column<Career>[] = [
    { key: "title", header: "Role", sortKey: "title", cell: (c) => (<div className="min-w-0"><Link href={`/admin/careers/${c.id}`} className="block max-w-md truncate font-medium text-ink hover:text-brand-600">{c.title}</Link><span className="text-xs text-muted">{c.department} · {c.location}</span></div>) },
    { key: "type", header: "Type", hideBelow: "md", cell: (c) => TYPE[c.employmentType] },
    { key: "deadline", header: "Deadline", sortKey: "deadline", hideBelow: "sm", cell: (c) => <span className="text-muted">{formatDate(c.deadline)}</span> },
    { key: "apps", header: "Applications", hideBelow: "lg", cell: (c) => <Link href={`/admin/applications?search=${encodeURIComponent(c.title)}`} className="text-brand-600 hover:underline">{apps.filter((a) => a.careerId === c.id).length}</Link> },
    { key: "status", header: "Status", sortKey: "status", cell: (c) => <StatusBadge status={c.status} /> },
  ];
  return (
    <>
      <PageHeader title="Careers & Job Openings" description="Publish roles and track application deadlines." actions={add} />
      <ResourceList service={careerService} entityLabel="job opening" nameOf={(c) => c.title} columns={columns} selectable archivable
        defaultSort={{ by: "deadline", dir: "asc" }} searchPlaceholder="Search role, department or location…"
        deleteGuard={(c) => {
          const n = apps.filter((a) => a.careerId === c.id).length;
          return n ? `${n} application${n > 1 ? "s" : ""} reference this opening. Close it instead of deleting.` : null;
        }}
        viewHref={(c) => `/admin/careers/${c.id}`} editHref={(c) => `/admin/careers/${c.id}/edit`}
        statuses={[{ value: "open" }, { value: "draft" }, { value: "closed" }]} currentStatus={(c) => c.status} emptyAction={add}
        filters={[
          { key: "status", label: "Status", options: [{ value: "open", label: "Open" }, { value: "draft", label: "Draft" }, { value: "closed", label: "Closed" }] },
          { key: "department", label: "Department", options: ["Trading", "Operations", "Finance", "Marketing", "Legal", "Technology"].map((v) => ({ value: v, label: v })) },
          { key: "employmentType", label: "Type", options: Object.entries(TYPE).map(([value, label]) => ({ value, label })) },
        ]} />
    </>
  );
}
