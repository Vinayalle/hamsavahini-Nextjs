import { z } from "zod";
import { json, parseQuery, requireSession, route } from "@/server/http";
import { globalSearch } from "@/server/services/search";

export const dynamic = "force-dynamic";

const query = z.object({ q: z.string().trim().max(80).default("") });

/** Global search across the modules the signed-in employee may view (permission and record scope are applied). */
export const GET = route(async (request) => {
  const session = await requireSession(request);
  const { q } = parseQuery(request, query);
  return json({ items: await globalSearch(session, q) });
});
