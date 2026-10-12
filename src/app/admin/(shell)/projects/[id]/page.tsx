"use client";

import { useParams } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { NotFoundRecord, PageHeader } from "@/components/admin/page-parts";
import { StatusBadge } from "@/components/admin/status-badge";
import { DetailList } from "@/components/admin/detail-parts";
import { RecordActions } from "@/components/admin/record-actions";
import { SafeHtml } from "@/components/admin/safe-html";
import { useBreadcrumbLabel } from "@/components/admin/use-breadcrumb-label";
import { useRecord } from "@/hooks/use-resource";
import { projectService } from "@/lib/services";
import { formatDate } from "@/lib/utils";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const project = useRecord(projectService, id);
  useBreadcrumbLabel(project?.title);
  if (!project) return <NotFoundRecord what="Project" backHref="/admin/projects" backLabel="Back to projects" service={projectService} />;

  return (
    <>
      <PageHeader
        title={project.title}
        description={`${project.client} · ${project.commodity} · ${project.region}`}
        actions={
          <RecordActions service={projectService} record={project} name={project.title} entityLabel="project" listHref="/admin/projects"
            editHref={`/admin/projects/${project.id}/edit`} status={project.status}
            transitions={[{ value: "published", label: "Publish" }, { value: "draft", label: "Move to draft" }]} />
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Trade story" />
          <div className="space-y-3 p-6">
            <p className="font-medium text-ink">{project.summary}</p>
            <SafeHtml html={project.content} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Project details" />
          <div className="p-5">
            <DetailList items={[
              { label: "Stage", value: <StatusBadge status={project.projectStatus} /> },
              { label: "Visibility", value: <StatusBadge status={project.status} /> },
              { label: "Featured", value: project.featured ? "Yes" : "No" },
              { label: "Start", value: formatDate(project.startDate) },
              { label: "End", value: formatDate(project.endDate) },
              { label: "Updated", value: formatDate(project.updatedAt, true) },
            ]} />
          </div>
        </Card>
      </div>
    </>
  );
}
