import { idParam, requireSession, route } from "@/server/http";
import { openBannerImageForAdmin } from "@/server/services/banner-image";

export const dynamic = "force-dynamic";

/** Preview of a banner picture inside the admin (session + banners:view). The website uses /api/public/banner-image instead. */
export const GET = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  const { file, bytes } = await openBannerImageForAdmin(session, idParam(id, "Image"));
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": "inline",
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=300",
    },
  });
});
