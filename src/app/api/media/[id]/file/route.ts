import { idParam, requireSession, route } from "@/server/http";
import { attachmentDisposition } from "@/server/storage";
import { openMedia } from "@/server/services/library";

export const dynamic = "force-dynamic";

/**
 * Streams a media file through the app so the bucket is never exposed. Needs a session and `media:view` (`?download=1` needs
 * `media:download`). Only validated image/video types are ever stored, and they are served with nosniff and a locked-down CSP.
 */
export const GET = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  const asDownload = new URL(request.url).searchParams.get("download") === "1";
  const { row, object } = await openMedia(session, idParam(id, "File"), asDownload);
  const headers = new Headers({
    "Content-Type": row.file.mimeType,
    "Content-Disposition": asDownload ? attachmentDisposition(row.file.originalName) : "inline",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "private, max-age=300",
  });
  if (object.contentLength !== undefined) headers.set("Content-Length", String(object.contentLength));
  return new Response(object.stream, { headers });
});
