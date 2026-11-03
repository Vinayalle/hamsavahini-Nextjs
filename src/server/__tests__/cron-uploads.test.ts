import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { call } from "./helpers";
import * as cron from "@/app/api/cron/uploads-cleanup/route";

/** The address Supabase Cron calls: secret-protected, no browser rules, and it really runs the cleanup. */
type H = Parameters<typeof call>[0];
const SECRET = "cron-secret-for-tests-only-0123456789";
const saved: Record<string, string | undefined> = {};
const ENV = ["CRON_SECRET", "UPLOAD_DIR", "PRODUCT_UPLOAD_DIR"] as const;
let root = "";

/** An old file named like an upload, with no database record: the cleanup should delete it. */
function orphan(): string {
  const path = join(root, "products", `${randomUUID()}.png`);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, "x");
  const t = new Date(Date.now() - 48 * 3_600_000);
  utimesSync(path, t, t);
  return path;
}
/** Exactly how pg_net calls: POST, no cookie, no Origin, a secret header. */
const hit = (headers: Record<string, string> = {}, url = "/api/cron/uploads-cleanup") => call(cron.POST as H, { method: "POST", url, origin: null, headers, body: {} });

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  root = mkdtempSync(join(tmpdir(), "hv-cron-"));
  process.env.UPLOAD_DIR = root;
  process.env.PRODUCT_UPLOAD_DIR = join(root, "products");
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});
beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
  rmSync(join(root, "products"), { recursive: true, force: true }); // each test starts with an empty folder
});

describe("POST /api/cron/uploads-cleanup", () => {
  it("does not exist (404) while CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const f = orphan();
    expect((await hit({ authorization: `Bearer ${SECRET}` })).status).toBe(404);
    expect(existsSync(f)).toBe(true);
  });

  it("refuses a missing, wrong or differently-shaped secret (401) and deletes nothing", async () => {
    const f = orphan();
    for (const headers of [{} as Record<string, string>, { authorization: "Bearer wrong" }, { authorization: SECRET }, { authorization: `Basic ${SECRET}` }, { authorization: `Bearer ${SECRET}x` }, { authorization: "Bearer " }]) {
      const r = await hit(headers);
      expect(r.status, JSON.stringify(headers)).toBe(401);
      expect(r.data.error.code).toBe("unauthorized");
    }
    expect(existsSync(f)).toBe(true);
  });

  it("with the right secret it runs the cleanup (no Origin header needed) and answers with counts only", async () => {
    const f = orphan();
    const r = await hit({ authorization: `Bearer ${SECRET}` });
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    expect(r.data).toMatchObject({ ok: true, dryRun: false, deletedFiles: 1 });
    expect(JSON.stringify(r.data)).not.toMatch(/\.png|products\//); // no file names in the answer
    expect(existsSync(f)).toBe(false);
  });

  it("?dryRun=1 only reports", async () => {
    const f = orphan();
    const r = await hit({ authorization: `Bearer ${SECRET}` }, "/api/cron/uploads-cleanup?dryRun=1");
    expect(r.data).toMatchObject({ dryRun: true, deletedFiles: 1 });
    expect(existsSync(f)).toBe(true);
  });

  it("answers 200 with ok:false (not a crash) when the cleanup refuses because most files look orphaned", async () => {
    const files = Array.from({ length: 12 }, orphan);
    const r = await hit({ authorization: `Bearer ${SECRET}` });
    expect(r.status).toBe(200);
    expect(r.data.ok).toBe(false);
    expect(r.data.refused).toMatch(/wrong database/);
    expect(files.every((f) => existsSync(f))).toBe(true);
    for (const f of files) rmSync(f, { force: true });
  });
});
