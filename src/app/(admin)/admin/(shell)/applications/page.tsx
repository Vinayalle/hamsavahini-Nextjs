"use client";

import { useState } from "react";
import { LuEye as Eye, LuFileText as FileText, LuLock as Lock } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import { DetailDrawer } from "@/components/admin/detail-parts";
import type { Column } from "@/components/admin/data-table";
import { CaseWorkflow } from "@/components/modules/case-drawer";
import { useAll, useRecord } from "@/hooks/use-resource";
import { ApiClientError, apiFetch, isApiMode } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { activityService, applicationService, careerService } from "@/lib/services";
import { formatBytes, formatDate } from "@/lib/utils";
import type { ApplicationStatus, JobApplication } from "@/types/entities";

const FLOW: Record<ApplicationStatus, ApplicationStatus[]> = {
  new: ["screening", "rejected"],
  screening: ["interview", "rejected"],
  interview: ["offer", "rejected"],
  offer: ["hired", "rejected"],
  hired: [],
  rejected: ["screening"],
};

export default function ApplicationsPage() {
  const careers = useAll(careerService);
  const [openId, setOpenId] = useState<string | null>(null);
  const [resumeFor, setResumeFor] = useState<JobApplication | null>(null);
  const app = useRecord(applicationService, openId ?? "");
  const role = (id: string) => careers.find((c) => c.id === id)?.title ?? "Unknown role";

  const { can } = useAuth();
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const canDownload = !isApiMode || can("job_applications", "download");

  const openResume = async (a: JobApplication) => {
    if (isApiMode) {
      // The server checks the permission, records the download in the audit log and returns a short-lived signed link.
      try {
        const r = await apiFetch<{ url: string }>(`/api/applications/${a.id}/resume`);
        window.open(r.url, "_blank", "noopener,noreferrer");
      } catch (e) {
        setResumeNotice(e instanceof ApiClientError ? (e.code === "storage_not_configured" ? "File storage is not configured on this server, so resumes cannot be opened yet. Nothing has been downloaded." : e.message) : "Could not open the resume");
        setResumeFor(a);
      }
      return;
    }
    setResumeNotice(null);
    setResumeFor(a);
    // Mock mode only: resume access is sensitive; the real server records it in the audit trail itself.
    void activityService.create({ actor: "Rahul Varma", action: "updated", entityType: "Job application", entityLabel: a.applicantName, detail: "Resume viewed" });
  };

  const columns: Column<JobApplication>[] = [
    { key: "name", header: "Applicant", sortKey: "applicantName", cell: (a) => (
      <button type="button" onClick={() => setOpenId(a.id)} className="text-left">
        <span className="block font-medium text-ink hover:text-brand-600">{a.applicantName}</span>
        <span className="block text-xs text-muted">{a.email}</span>
      </button>
    ) },
    { key: "role", header: "Role", hideBelow: "sm", cell: (a) => <span className="line-clamp-1 max-w-xs">{role(a.careerId)}</span> },
    { key: "exp", header: "Experience", sortKey: "experienceYears", hideBelow: "lg", cell: (a) => `${a.experienceYears} yr${a.experienceYears === 1 ? "" : "s"}` },
    { key: "status", header: "Status", sortKey: "status", cell: (a) => <StatusBadge status={a.status} /> },
    { key: "applied", header: "Applied", sortKey: "createdAt", hideBelow: "md", cell: (a) => <span className="text-muted">{formatDate(a.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader title="Job Applications" description="Review candidates and move them through the hiring pipeline." />
      <ResourceList
        service={applicationService} entityLabel="application" nameOf={(a) => a.applicantName} columns={columns} selectable
        defaultSort={{ by: "createdAt", dir: "desc" }} searchPlaceholder="Search applicant or email…"
        extraRowActions={(a) => [
          { label: "View & manage", icon: Eye, onSelect: () => setOpenId(a.id) },
          { label: "View resume", icon: FileText, hidden: !canDownload, onSelect: () => openResume(a) },
        ]}
        statuses={[{ value: "screening" }, { value: "interview" }, { value: "rejected" }]} currentStatus={(a) => a.status}
        filters={[
          { key: "status", label: "Status", options: [{ value: "open", label: "Open (not hired/rejected)" }, ...Object.keys(FLOW).map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))] },
          { key: "careerId", label: "Role", options: careers.map((c) => ({ value: c.id, label: c.title })) },
        ]}
      />

      <DetailDrawer
        open={!!app} onOpenChange={(o) => !o && setOpenId(null)}
        title={app?.applicantName ?? ""} description={app ? `${role(app.careerId)} · applied ${formatDate(app.createdAt, true)}` : undefined}
      >
        {app && (
          <CaseWorkflow
            service={applicationService} record={app} name={app.applicantName} resource="job_applications" finalStatuses={["rejected", "hired"]} assignable={false}
            transitions={(s) => FLOW[s as ApplicationStatus] ?? []}
            details={[
              { label: "Email", value: <a href={`mailto:${app.email}`} className="text-brand-600 hover:underline">{app.email}</a> },
              { label: "Phone", value: app.phone },
              { label: "Current company", value: app.currentCompany },
              { label: "Experience", value: `${app.experienceYears} years` },
              { label: "Cover note", value: <span className="whitespace-pre-wrap">{app.coverNote}</span> },
            ]}
          >
            <div className="flex items-center gap-3 rounded-lg border border-line p-3">
              <FileText className="size-5 text-faint" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{app.resumeFileName}</p>
                <p className="text-xs text-muted">{formatBytes(app.resumeSizeBytes)} · protected</p>
              </div>
              {canDownload && <Button size="sm" variant="secondary" onClick={() => openResume(app)}><Lock className="size-3.5" /> View resume</Button>}
            </div>
          </CaseWorkflow>
        )}
      </DetailDrawer>

      <Dialog open={!!resumeFor} onOpenChange={(o) => !o && setResumeFor(null)}>
        <DialogContent className="p-6">
          <DialogTitle>Protected resume</DialogTitle>
          <DialogDescription>{resumeFor?.resumeFileName}</DialogDescription>
          <div className="mt-4 rounded-lg border border-dashed border-line bg-canvas p-5 text-sm text-muted">
            <p className="flex items-center gap-2 font-medium text-ink"><Lock className="size-4" /> Access controlled</p>
            {resumeNotice ? <p className="mt-2" role="alert">{resumeNotice}</p> : (
              <>
                <p className="mt-2">In production this opens a short-lived, signed link after the backend checks your permission. Resumes are never publicly addressable, and each view is recorded in the activity log.</p>
                <p className="mt-2">No file is stored in this preview build, so there is nothing to display.</p>
              </>
            )}
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={() => { setResumeFor(null); if (!isApiMode) toast.info("View recorded in Activity Logs"); }}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
