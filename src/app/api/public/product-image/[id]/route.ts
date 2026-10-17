import { idParam, route } from "@/server/http";
import { openProductImage } from "@/server/services/site";

export const dynamic = "force-dynamic";

/**
 * Public (no session) picture of a PUBLISHED product for the website. It serves nothing else: the picture must belong to a published
 * product in a published category, be a validated public image, and is only readable through this route.
 */
export const GET = route<{ id: string }>(async (_request, { id }) => {
  const { file, bytes } = await openProductImage(idParam(id, "Image"));
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": "inline",
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
