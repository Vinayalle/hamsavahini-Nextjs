import { idParam, route } from "@/server/http";
import { openBannerImage } from "@/server/services/site";

export const dynamic = "force-dynamic";

/**
 * Public (no session) picture of a LIVE hero banner for the website. It serves nothing else: the banner must be published and inside its
 * schedule, the file must be a validated image, and the file is only readable through this route. The `?v=` query only busts caches when the banner changes.
 */
export const GET = route<{ id: string }>(async (_request, { id }) => {
  const { file, bytes } = await openBannerImage(idParam(id, "Image"));
  const headers = new Headers({
    "Content-Type": file.mimeType,
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "public, max-age=3600",
    "X-Robots-Tag": "noindex",
  });
  headers.set("Content-Length", String(bytes.length));
  return new Response(new Uint8Array(bytes), { headers });
});
