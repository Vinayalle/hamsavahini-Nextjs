import { json, route } from "@/server/http";
import { createRfq } from "@/server/services/submissions";

export const dynamic = "force-dynamic";

/** Public request-for-quotation form. Answers with the reference number the customer can quote later. */
export const POST = route(async (request) => json(await createRfq(request), { status: 201 }));
