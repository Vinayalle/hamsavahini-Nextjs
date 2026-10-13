import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getSession, type AuthSession } from "./auth";
import { ApiError, errors } from "./errors";

export { ApiError, errors };

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF defence for cookie-authenticated mutations (defence in depth on top of SameSite=Lax):
 * the Origin must match the Host, and the body must be JSON (which a cross-site <form> cannot send).
 */
function assertSameOrigin(request: Request, allowMultipart = false) {
  if (!UNSAFE.has(request.method)) return;
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) throw new ApiError(403, "bad_origin", "Cross-origin request blocked");
  const type = request.headers.get("content-type") ?? "";
  const hasBody = request.headers.get("content-length") !== "0" && request.method !== "DELETE";
  if (hasBody && !type.includes("application/json") && !(allowMultipart && type.startsWith("multipart/form-data"))) throw new ApiError(415, "unsupported_media_type", "Expected application/json");
}

export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw errors.invalid("Request body must be valid JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw errors.invalid("Some fields are invalid", fieldErrors(parsed.error));
  return parsed.data;
}

export function parseQuery<T>(request: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw errors.invalid("Invalid query", fieldErrors(parsed.error));
  return parsed.data;
}

/** Prisma reports an unreachable server as P1001, or as a driver-adapter "DatabaseNotReachable" inside a raw-query error (P2010). */
function isDatabaseUnreachable(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P1001" || error.code === "P1002" || error.code === "P1017") return true;
  const adapter = (error.meta as { driverAdapterError?: { message?: string } } | undefined)?.driverAdapterError;
  return adapter?.message === "DatabaseNotReachable";
}

function toResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: { code: error.code, message: error.message, fields: error.fields } }, { status: error.status, headers: { "Cache-Control": "no-store", ...(error.headers ?? {}) } });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Constraint violations surface as client errors, never as raw database messages.
    if (error.code === "P2002") return NextResponse.json({ error: { code: "conflict", message: "A record with the same unique value already exists" } }, { status: 409 });
    if (error.code === "P2003") return NextResponse.json({ error: { code: "conflict", message: "This record is still referenced by other records" } }, { status: 409 });
    if (error.code === "P2025") return NextResponse.json({ error: { code: "not_found", message: "Record not found" } }, { status: 404 });
  }
  if (isDatabaseUnreachable(error)) {
    console.error("[api] database unreachable (check DATABASE_URL, that the project is not paused, and that this network can reach it)");
    return NextResponse.json({ error: { code: "database_unavailable", message: "The database cannot be reached right now. Please try again in a moment." } }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "10" } });
  }
  console.error("[api] unhandled error", error);
  return NextResponse.json({ error: { code: "internal", message: "Something went wrong" } }, { status: 500 });
}

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps a route handler: same-origin check for mutations, uniform JSON errors.
 * Handlers that need a user call `requireSession(request)` / `authorize(...)` themselves
 * so that authentication and authorization are visible at the top of every handler.
 */
export function route<P = Record<string, never>>(fn: (request: Request, params: P) => Promise<Response>, opts: { multipart?: boolean } = {}) {
  return async (request: Request, ctx?: Ctx<P>): Promise<Response> => {
    try {
      assertSameOrigin(request, opts.multipart);
      return await fn(request, ((await ctx?.params) ?? {}) as P);
    } catch (e) {
      return toResponse(e);
    }
  };
}

export async function requireSession(request: Request): Promise<AuthSession> {
  const session = await getSession(request);
  if (!session) throw errors.unauthenticated();
  return session;
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Malformed ids are indistinguishable from unknown ones (404), so they cannot be used to probe. */
export function idParam(id: string, what = "Record"): string {
  if (!uuidRe.test(id)) throw errors.notFound(what);
  return id;
}
