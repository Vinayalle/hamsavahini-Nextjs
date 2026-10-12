import { json, requireSession, route } from "@/server/http";
import { attentionCounts } from "@/server/services/search";

export const dynamic = "force-dynamic";

/** Counts for the notification bell, limited to the modules (and records) the signed-in employee may see. */
export const GET = route(async (request) => json(await attentionCounts(await requireSession(request))));
