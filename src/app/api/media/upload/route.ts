import { json, requireSession, route } from "@/server/http";
import { uploadMedia } from "@/server/services/library";

export const dynamic = "force-dynamic";

/** Multipart upload (file, folder, altText). The bytes are validated (type from content, size), stored in private object storage, then recorded. */
export const POST = route(async (request) => {
  const session = await requireSession(request);
  return json(await uploadMedia(request, session), { status: 201 });
}, { multipart: true });
