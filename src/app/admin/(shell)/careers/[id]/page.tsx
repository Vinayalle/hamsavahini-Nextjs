"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, NotFoundRecord, PageHeader } from "@/components/admin/page-parts";
import { StatusBadge } from "@/components/admin/status-badge";
import { DetailList } from "@/components/admin/detail-parts";
import { RecordActions } from "@/components/admin/record-actions";
import { SafeHtml } from "@/components/admin/safe-html";
import { useBreadcrumbLabel } from "@/components/admin/use-breadcrumb-label";
import { useAll, useRecord } from "@/hooks/use-resource";
import { applicationService, careerService } from "@/lib/services";
import { formatDate } from "@/lib/utils";

export default function CareerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const career = useRecord(careerService, id);
  const apps = useAll(applicationService).filter((a) => a.careerId === id);
  useBreadcrumbLabel(career?.title);
  if (!career) return <NotFoundRecord what="Job opening" backHref="/admin/careers" backLabel="Back to careers" service={careerService} />;

  const today = new Date().toISOString().slice(0, 10);
  const expired = career.deadline < today;

  return (
    <>
      <PageHeader
        title={career.title}
        description={`${career.department} · ${career.location}`}
        actions={
          <RecordActions service={careerService} record={career} name={career.title} entityLabel="job opening" listHref="/admin/careers"
            editHref={`/admin/careers/${career.id}/edit`} status={career.status} archivable={false}
            transitions={[{ value: "open", label: "Open role" }, { value: "closed", label: "Close role" }, { value: "draft", label: "Move to draft" }]} />
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card><CardHeader title="Description" /><div className="p-6"><SafeHtml html={career.description} /></div></Card>
          <Card><CardHeader title="Requirements" /><div className="p-6"><SafeHtml html={career.requirements} /></div></Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Role details" />
            <div className="p-5">
              <DetailList items={[
                { label: "Status", value: <StatusBadge status={career.status} /> },
                { label: "Deadline", value: <span className={expired ? "text-danger-600" : ""}>{formatDate(career.deadline)}{expired ? " (passed)" : ""}</span> },
                { label: "Openings", value: career.openings },
                { label: "Type", value: career.employmentType.replace("_", " ") },
                { label: "Experience", value: career.experience },
                { label: "Updated", value: formatDate(career.updatedAt) },
              ]} />
            </div>
          </Card>
          <Card>
            <CardHeader title={`Applications (${apps.length})`} />
            {apps.length === 0 ? <EmptyState title="No applications yet" /> : (
              <ul className="divide-y divide-line">
                {apps.map((a) => (
                  <li key={a.id}>
                    <Link href={`/admin/applications?search=${encodeURIComponent(a.applicantName)}`} className="flex items-center justify-between gap-2 px-5 py-3 text-sm hover:bg-canvas/60">
                      <span className="truncate font-medium text-ink">{a.applicantName}</span>
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
