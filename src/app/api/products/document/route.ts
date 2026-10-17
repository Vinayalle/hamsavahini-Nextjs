import { json, requireSession, route } from "@/server/http";
import { uploadProductFile } from "@/server/services/product-files";

export const dynamic = "force-dynamic";

/** Multipart upload of one product document (field "file"): datasheet, certificate, brochure. Saved inside the project. */
export const POST = route(async (request) => {
  const session = await requireSession(request);
  return json(await uploadProductFile(request, session, "document"), { status: 201 });
}, { multipart: true });
