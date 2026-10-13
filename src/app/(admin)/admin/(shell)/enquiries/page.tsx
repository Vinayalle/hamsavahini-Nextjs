"use client";

import { useState } from "react";
import { LuEye as Eye } from "react-icons/lu";
import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import { DetailDrawer } from "@/components/admin/detail-parts";
import type { Column } from "@/components/admin/data-table";
import { CaseWorkflow } from "@/components/modules/case-drawer";
import { useRecord } from "@/hooks/use-resource";
import { enquiryService } from "@/lib/services";
import { formatDate } from "@/lib/utils";
import type { ContactEnquiry, EnquiryStatus } from "@/types/entities";

const FLOW: Record<EnquiryStatus, EnquiryStatus[]> = {
  new: ["contacted", "closed", "spam"],
  contacted: ["closed", "spam"],
  closed: ["contacted"],
  spam: ["new"],
};

export default function EnquiriesPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const enquiry = useRecord(enquiryService, openId ?? "");

  const columns: Column<ContactEnquiry>[] = [
    { key: "from", header: "From", sortKey: "name", cell: (e) => (
      <button type="button" onClick={() => setOpenId(e.id)} className="text-left">
        <span className="block font-medium text-ink hover:text-brand-600">{e.name}</span>
        <span className="block text-xs text-muted">{e.email}</span>
      </button>
    ) },
    { key: "subject", header: "Subject", hideBelow: "sm", cell: (e) => <span className="line-clamp-1 max-w-xs">{e.subject}</span> },
    { key: "source", header: "Source", hideBelow: "lg", cell: (e) => <span className="text-muted">{e.source}</span> },
    { key: "status", header: "Status", sortKey: "status", cell: (e) => <StatusBadge status={e.status} /> },
    { key: "assigned", header: "Owner", hideBelow: "lg", cell: (e) => <span className="text-muted">{e.assignedTo ?? "Unassigned"}</span> },
    { key: "received", header: "Received", sortKey: "createdAt", hideBelow: "md", cell: (e) => <span className="text-muted">{formatDate(e.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader title="Contact Enquiries" description="Messages submitted through the website contact forms." />
      <ResourceList
        service={enquiryService} entityLabel="enquiry" nameOf={(e) => e.name} columns={columns} selectable
        defaultSort={{ by: "createdAt", dir: "desc" }} searchPlaceholder="Search name, email, subject or message…"
        extraRowActions={(e) => [{ label: "View & respond", icon: Eye, onSelect: () => setOpenId(e.id) }]}
        statuses={[{ value: "contacted" }, { value: "closed" }, { value: "spam" }]} currentStatus={(e) => e.status}
        filters={[
          { key: "status", label: "Status", options: [{ value: "open", label: "Open (new + contacted)" }, { value: "new", label: "New" }, { value: "contacted", label: "Contacted" }, { value: "closed", label: "Closed" }, { value: "spam", label: "Spam" }] },
          { key: "source", label: "Source", options: ["Contact page", "Footer form", "Product page"].map((v) => ({ value: v, label: v })) },
        ]}
      />
      <DetailDrawer
        open={!!enquiry} onOpenChange={(o) => !o && setOpenId(null)}
        title={enquiry?.subject ?? ""} description={enquiry ? `From ${enquiry.name} · ${formatDate(enquiry.createdAt, true)}` : undefined}
      >
        {enquiry && (
          <CaseWorkflow
            service={enquiryService} record={enquiry} name={enquiry.name} resource="enquiries" finalStatuses={["spam"]}
            transitions={(s) => FLOW[s as EnquiryStatus] ?? []}
            details={[
              { label: "Name", value: enquiry.name },
              { label: "Email", value: <a href={`mailto:${enquiry.email}?subject=Re: ${encodeURIComponent(enquiry.subject)}`} className="text-brand-600 hover:underline">{enquiry.email}</a> },
              { label: "Phone", value: enquiry.phone },
              { label: "Company", value: enquiry.company },
              { label: "Source", value: enquiry.source },
              { label: "Message", value: <span className="whitespace-pre-wrap">{enquiry.message}</span> },
            ]}
          />
        )}
      </DetailDrawer>
    </>
  );
}
