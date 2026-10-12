import { logout } from "@/server/auth";
import { withCookies } from "@/server/cookies";
import { json, route } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = route(async (request) => {
  const cookies = await logout(request);
  return withCookies(json({ ok: true }), cookies);
});
