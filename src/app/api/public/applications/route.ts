import { json, route } from "@/server/http";
import { createApplication } from "@/server/services/submissions";

export const dynamic = "force-dynamic";

/** Public job application (multipart: fields plus an optional resume). */
export const POST = route(async (request) => json(await createApplication(request), { status: 201 }), { multipart: true });
