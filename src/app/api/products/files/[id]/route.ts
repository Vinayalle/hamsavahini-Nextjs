import { idParam, requireSession, route } from "@/server/http";
import { attachmentDisposition } from "@/server/storage";
import { openProductFileForAdmin } from "@/server/services/product-files";

export const dynamic = "force-dynamic";

/** Preview of a product picture, or download of a product document, inside the admin (session + products:view). */
export const GET = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  const { file, bytes } = await openProductFileForAdmin(session, idParam(id, "File"));
  const image = file.kind === "image";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": image ? "inline" : attachmentDisposition(file.originalName),
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=300",
    },
  });
});
