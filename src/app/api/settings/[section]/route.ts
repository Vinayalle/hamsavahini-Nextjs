import { json, route, requireSession } from "@/server/http";
import { getSetting, putSetting } from "@/server/services/settings";

export const dynamic = "force-dynamic";

export const GET = route<{ section: string }>(async (request, { section }) => {
  const session = await requireSession(request);
  return json(await getSetting(session, section));
});

export const PUT = route<{ section: string }>(async (request, { section }) => {
  const session = await requireSession(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  return json(await putSetting(session, section, body));
});
