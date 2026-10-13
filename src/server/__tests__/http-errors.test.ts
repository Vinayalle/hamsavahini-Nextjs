import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { route } from "@/server/http";

const run = async (error: unknown) => {
  const handler = route(async () => {
    throw error;
  });
  const res = await handler(new Request("http://localhost:3000/api/x", { method: "GET", headers: { host: "localhost:3000" } }));
  return { status: res.status, body: await res.json(), headers: res.headers };
};
const known = (code: string, meta?: Record<string, unknown>) => new Prisma.PrismaClientKnownRequestError("boom", { code, clientVersion: "test", meta });

describe("database errors are reported plainly, never as raw database text", () => {
  it("an unreachable database answers 503 with a retry hint", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const e of [known("P1001"), known("P1002"), known("P1017"), known("P2010", { driverAdapterError: { message: "DatabaseNotReachable" } })]) {
      const r = await run(e);
      expect(r.status).toBe(503);
      expect(r.body.error.code).toBe("database_unavailable");
      expect(r.headers.get("retry-after")).toBe("10");
      expect(JSON.stringify(r.body)).not.toMatch(/supabase|boom|prisma/i);
    }
    vi.restoreAllMocks();
  });

  it("other unexpected errors stay a generic 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await run(known("P2010", { driverAdapterError: { message: "SomethingElse" } }));
    expect(r.status).toBe(500);
    expect(r.body.error.code).toBe("internal");
    vi.restoreAllMocks();
  });
});
