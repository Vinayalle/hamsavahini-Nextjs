import { json, route } from "@/server/http";
import { createEnquiry } from "@/server/services/submissions";

export const dynamic = "force-dynamic";

/** Public contact form. No session; protected by validation, a honeypot and rate limits (see services/submissions.ts). */
export const POST = route(async (request) => json(await createEnquiry(request), { status: 201 }));
