import { json, requireSession, route } from "@/server/http";
import { isStorageConfigured } from "@/server/storage";

export const dynamic = "force-dynamic";

/** Whether file storage is configured (never reveals the bucket, endpoint or any credential). */
export const GET = route(async (request) => {
  await requireSession(request);
  return json({ configured: isStorageConfigured() });
});
