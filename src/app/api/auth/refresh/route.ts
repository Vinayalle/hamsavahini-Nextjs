import { refresh } from "@/server/auth";
import { clearAll, withCookies } from "@/server/cookies";
import { ApiError } from "@/server/errors";
import { json, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** Rotates the refresh token and issues a new access token. A failed refresh clears the auth cookies (except on a benign race). */
export const POST = route(async (request) => {
  try {
    const issued = await refresh(request);
    return withCookies(json({ user: issued.user }), issued.cookies);
  } catch (e) {
    if (e instanceof ApiError && e.code === "unauthenticated") {
      const res = json({ error: { code: e.code, message: e.message } }, { status: 401 });
      return withCookies(res, clearAll());
    }
    throw e;
  }
});
