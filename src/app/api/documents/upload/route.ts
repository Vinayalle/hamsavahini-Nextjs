import { json, requireSession, route } from "@/server/http";
import { uploadDocument } from "@/server/services/library";

export const dynamic = "force-dynamic";

/** Multipart upload (file, title, category, version, visibility, status) into private object storage. */
export const POST = route(async (request) => {
  const session = await requireSession(request);
  return json(await uploadDocument(request, session), { status: 201 });
}, { multipart: true });
