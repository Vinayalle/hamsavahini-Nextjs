import { getDb } from "@/server/db";
import { ApiError } from "@/server/errors";
import { idParam, json, requireSession, route } from "@/server/http";
import { authorize } from "@/server/rbac";
import { recordActivity, clientIp } from "@/server/audit";
import { getStorage } from "@/server/storage";

export const dynamic = "force-dynamic";

/**
 * Private resume download. Requires `job_applications:download`. The resume is never served from the database or from a
 * public path: the response is a short-lived signed URL from the object store, and each download is audited.
 * Storage is not configured in this build, so this answers 503 (after authorization) rather than pretending.
 */
export const GET = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "job_applications", "download");
  const db = getDb();
  const app = await db.jobApplication.findUnique({ where: { id: idParam(id, "Application") }, select: { id: true, applicantName: true, anonymizedAt: true, resumeFile: { select: { storageKey: true, originalName: true } } } });
  if (!app || !app.resumeFile || app.anonymizedAt) throw new ApiError(404, "not_found", "Resume not found");
  const storage = getStorage();
  if (!storage) throw new ApiError(503, "storage_not_configured", "File storage is not configured, so resumes cannot be downloaded yet.");
  const url = await storage.signedDownloadUrl(app.resumeFile.storageKey, { fileName: app.resumeFile.originalName, expiresInSeconds: 60 });
  await recordActivity(db, { session, action: "viewed_sensitive", entityType: "Job application", entityId: app.id, entityLabel: app.applicantName, detail: "resume downloaded", ip: clientIp(request) });
  return json({ url, expiresInSeconds: 60 });
});
