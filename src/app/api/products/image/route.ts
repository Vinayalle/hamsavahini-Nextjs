import { json, requireSession, route } from "@/server/http";
import { uploadProductFile } from "@/server/services/product-files";

export const dynamic = "force-dynamic";

/** Multipart upload of one product picture (field "file"). Saved inside the project; returns the id the product form keeps. */
export const POST = route(async (request) => {
  const session = await requireSession(request);
  return json(await uploadProductFile(request, session, "image"), { status: 201 });
}, { multipart: true });
