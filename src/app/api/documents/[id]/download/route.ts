import { idParam, json, requireSession, route } from "@/server/http";
import { documentDownload } from "@/server/services/library";

export const dynamic = "force-dynamic";

/** Needs `documents:download`. Returns a 60-second signed link to the private object (non-public documents are audited). */
export const GET = route<{ id: string }>(async (request, { id }) => {
  const session = await requireSession(request);
  return json(await documentDownload(request, session, idParam(id, "Document")));
});
