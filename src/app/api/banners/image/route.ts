import { json, requireSession, route } from "@/server/http";
import { uploadBannerImage } from "@/server/services/banner-image";

export const dynamic = "force-dynamic";

/** Multipart upload of one banner picture (field "file"). Saved inside the project; returns the id the banner form keeps. */
export const POST = route(async (request) => {
  const session = await requireSession(request);
  return json(await uploadBannerImage(request, session), { status: 201 });
}, { multipart: true });
