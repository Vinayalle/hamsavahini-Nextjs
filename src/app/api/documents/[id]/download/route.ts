import { idParam, requireSession, route } from "@/server/http";
import { documentDownload } from "@/server/services/library";
import { attachmentDisposition } from "@/server/storage";

export const dynamic = "force-dynamic";

/** Needs `documents:download`. Sends the private file as a download (non-public documents are audited). */
export const GET = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  const f = await documentDownload(request, session, idParam(id, "Document"));
  return new Response(new Uint8Array(f.bytes), {
    headers: {
      "Content-Type": f.mimeType,
      "Content-Disposition": attachmentDisposition(f.fileName),
      "Content-Length": String(f.bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
});
