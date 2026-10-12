"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import { DetailDrawer } from "@/components/admin/detail-parts";
import type { Column } from "@/components/admin/data-table";
import { CaseWorkflow } from "@/components/modules/case-drawer";
import { useRecord } from "@/hooks/use-resource";
import { rfqService } from "@/lib/services";
import { formatDate } from "@/lib/utils";
import type { Rfq, RfqStatus } from "@/types/entities";

const STATUSES: RfqStatus[] = ["new", "contacted", "under_discussion", "quotation_sent", "closed"];
const FLOW: Record<RfqStatus, RfqStatus[]> = {
  new: ["contacted", "closed"],
  contacted: ["under_discussion", "quotation_sent", "closed"],
  under_discussion: ["quotation_sent", "closed"],
  quotation_sent: ["under_discussion", "closed"],
  closed: ["contacted"],
};

export default function RfqsPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const rfq = useRecord(rfqService, openId ?? "");

  const columns: Column<Rfq>[] = [
    { key: "ref", header: "RFQ", sortKey: "reference", cell: (r) => (
      <button type="button" onClick={() => setOpenId(r.id)} className="text-left">
        <span className="block font-medium text-ink hover:text-brand-600">{r.reference}</span>
        <span className="block text-xs text-muted">{r.companyName}</span>
      </button>
    ) },
    { key: "product", header: "Requirement", hideBelow: "sm", cell: (r) => (<div><span className="block">{r.productOrCommodity}</span><span className="text-xs text-muted">{r.quantity.toLocaleString("en-US")} {r.quantityUnit} · {r.incoterm}</span></div>) },
    { key: "country", header: "Country", sortKey: "country", hideBelow: "lg", cell: (r) => r.country },
    { key: "status", header: "Status", sortKey: "status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "assigned", header: "Owner", hideBelow: "lg", cell: (r) => <span className="text-muted">{r.assignedTo ?? "Unassigned"}</span> },
    { key: "received", header: "Received", sortKey: "createdAt", hideBelow: "md", cell: (r) => <span className="text-muted">{formatDate(r.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader title="RFQs & Trade Enquiries" description="Track requests for quotation from first contact to quotation and close." />
      <ResourceList
        service={rfqService} entityLabel="RFQ" nameOf={(r) => r.reference} columns={columns} deletable
        defaultSort={{ by: "createdAt", dir: "desc" }} searchPlaceholder="Search reference, company or product…"
        extraRowActions={(r) => [{ label: "View & manage", icon: Eye, onSelect: () => setOpenId(r.id) }]}
        statuses={[]} currentStatus={(r) => r.status}
        filters={[{
          key: "status", label: "Status",
          options: [{ value: "pending", label: "Pending (new + contacted)" }, ...STATUSES.map((s) => ({ value: s, label: s.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase()) }))],
        }]}
      />
      <DetailDrawer
        open={!!rfq} onOpenChange={(o) => !o && setOpenId(null)}
        title={rfq?.reference ?? ""} description={rfq ? `${rfq.companyName} · received ${formatDate(rfq.createdAt, true)}` : undefined}
      >
        {rfq && (
          <CaseWorkflow
            service={rfqService} record={rfq} name={rfq.reference} resource="rfqs" finalStatuses={["closed"]}
            transitions={(s) => FLOW[s as RfqStatus] ?? []}
            details={[
              { label: "Company", value: rfq.companyName },
              { label: "Contact", value: rfq.contactName },
              { label: "Email", value: <a href={`mailto:${rfq.email}`} className="text-brand-600 hover:underline">{rfq.email}</a> },
              { label: "Phone", value: rfq.phone },
              { label: "Country", value: rfq.country },
              { label: "Delivery port", value: rfq.deliveryPort },
              { label: "Product / commodity", value: rfq.productOrCommodity },
              { label: "Quantity", value: `${rfq.quantity.toLocaleString("en-US")} ${rfq.quantityUnit}` },
              { label: "Incoterm", value: rfq.incoterm },
              { label: "Target price", value: rfq.targetPrice },
              { label: "Message", value: <span className="whitespace-pre-wrap">{rfq.message}</span> },
            ]}
          />
        )}
      </DetailDrawer>
    </>
  );
}
