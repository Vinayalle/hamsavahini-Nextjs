import { getDb } from "@/server/db";
import { ApiError } from "@/server/errors";
import { idParam, requireSession, route } from "@/server/http";
import { authorize } from "@/server/rbac";
import { recordActivity, clientIp } from "@/server/audit";
import { attachmentDisposition, getStorage } from "@/server/storage";

export const dynamic = "force-dynamic";

/**
 * Private resume download. Requires `job_applications:download`. The resume is never served from a public path: it is read from the
 * project's uploads folder and sent only after the permission check, and each download is audited.
 */
export const GET = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  authorize(session, "job_applications", "download");
  const db = getDb();
  const app = await db.jobApplication.findUnique({ where: { id: idParam(id, "Application") }, select: { id: true, applicantName: true, anonymizedAt: true, resumeFile: { select: { storageKey: true, originalName: true, mimeType: true } } } });
  if (!app || !app.resumeFile || app.anonymizedAt) throw new ApiError(404, "not_found", "Resume not found");
  const storage = getStorage();
  if (!storage) throw new ApiError(503, "storage_not_configured", "File storage is not configured, so resumes cannot be downloaded yet.");
  let bytes: Buffer;
  try {
    bytes = Buffer.from(await new Response((await storage.get(app.resumeFile.storageKey)).stream).arrayBuffer());
  } catch (e) {
    if (e instanceof Error && e.name === "NoSuchKey") throw new ApiError(404, "not_found", "Resume not found");
    console.error("[api] resume read failed", e instanceof Error ? e.name : "unknown");
    throw new ApiError(502, "storage_read_failed", "The resume could not be read from storage.");
  }
  await recordActivity(db, { session, action: "viewed_sensitive", entityType: "Job application", entityId: app.id, entityLabel: app.applicantName, detail: "resume downloaded", ip: clientIp(request) });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": app.resumeFile.mimeType,
      "Content-Disposition": attachmentDisposition(app.resumeFile.originalName),
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
});
