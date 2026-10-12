import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import S3rver from "s3rver";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { getDb } from "@/server/db";
import { createS3Storage, getStorage, setStorageForTests, type ObjectStorage } from "@/server/storage";
import { getStorageConfig } from "@/server/config";
import { detectFile, cleanFileName } from "@/server/files";
import { call, ensurePermissions, loginCookie, makeRole, makeUser } from "./helpers";
import * as mediaUpload from "@/app/api/media/upload/route";
import * as mediaFile from "@/app/api/media/[id]/file/route";
import * as docUpload from "@/app/api/documents/upload/route";
import * as docDownload from "@/app/api/documents/[id]/download/route";
import * as resume from "@/app/api/applications/[id]/resume/route";
import * as storageStatus from "@/app/api/storage/status/route";
import * as listRoute from "@/app/api/[resource]/route";
import * as itemRoute from "@/app/api/[resource]/[id]/route";

type H = Parameters<typeof call>[0];
const db = () => getDb();
const ck: Record<string, string> = {};
const uid: Record<string, string> = {};
let s3: S3rver;
let dir = "";
const PORT = 4570 + Math.floor(Math.random() * 300);
const BUCKET = "hv-test";
const ENV = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_ENDPOINT", "S3_REGION", "S3_FORCE_PATH_STYLE"] as const;

/** A valid 8x6 PNG (real chunks, real CRCs are not checked by the detector but dimensions are read from IHDR). */
function png(width = 8, height = 6): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); ihdr.write("IHDR", 4); ihdr.writeUInt32BE(width, 8); ihdr.writeUInt32BE(height, 12); ihdr[16] = 8; ihdr[17] = 2;
  const idat = deflateSync(Buffer.alloc((width * 3 + 1) * height));
  const idatChunk = Buffer.concat([Buffer.from([0, 0, 0, idat.length]), Buffer.from("IDAT"), idat, Buffer.alloc(4)]);
  return Buffer.concat([sig, ihdr, idatChunk, Buffer.from([0, 0, 0, 0]), Buffer.from("IEND"), Buffer.alloc(4)]);
}
const pdf = () => Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
const file = (bytes: Buffer, name: string, type: string) => new File([new Uint8Array(bytes)], name, { type });
const form = (f: File | null, fields: Record<string, string> = {}) => {
  const fd = new FormData();
  if (f) fd.set("file", f);
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const upMedia = (cookie: string | undefined, fd: FormData) => call(mediaUpload.POST as H, { method: "POST", url: "/api/media/upload", cookie, body: "multipart", form: fd });
const upDoc = (cookie: string | undefined, fd: FormData) => call(docUpload.POST as H, { method: "POST", url: "/api/documents/upload", cookie, body: "multipart", form: fd });
const docFields = { title: "Quality certificate", category: "Certificate", version: "1.0", visibility: "internal", status: "draft" };
const objects = async (storage: ObjectStorage, key: string) => storage.get(key).then(async (o) => Buffer.from(await new Response(o.stream).arrayBuffer()));

let storage: ObjectStorage;
const savedEnv: Record<string, string | undefined> = {};

beforeAll(async () => {
  for (const k of ENV) savedEnv[k] = process.env[k];
  dir = mkdtempSync(join(tmpdir(), "hv-s3-"));
  s3 = new S3rver({ port: PORT, address: "127.0.0.1", silent: true, directory: dir, configureBuckets: [{ name: BUCKET, configs: [] }] });
  await s3.run();
  await ensurePermissions();
  const d = db();
  await d.adminUser.deleteMany();
  await d.role.deleteMany();
  const sa = await makeRole("Super Admin", {}, true);
  const uploader = await makeRole("Uploader", { media: ["view", "upload"], documents: ["view", "upload"] });
  const viewer = await makeRole("Viewer", { media: ["view"], documents: ["view"], job_applications: ["view"] });
  const downloader = await makeRole("Downloader", { media: ["view", "download"], documents: ["view", "download"], job_applications: ["view", "download"] });
  const nothing = await makeRole("Nothing", {});
  uid.sa = (await makeUser("sa@s.dev", sa.id)).id;
  uid.uploader = (await makeUser("uploader@s.dev", uploader.id)).id;
  uid.viewer = (await makeUser("viewer@s.dev", viewer.id)).id;
  uid.downloader = (await makeUser("downloader@s.dev", downloader.id)).id;
  uid.none = (await makeUser("none@s.dev", nothing.id)).id;
  for (const k of ["sa", "uploader", "viewer", "downloader", "none"]) ck[k] = await loginCookie(`${k}@s.dev`);
});
afterAll(async () => {
  await s3.close();
  rmSync(dir, { recursive: true, force: true });
  setStorageForTests(undefined);
  for (const k of ENV) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

const configure = () => {
  Object.assign(process.env, { S3_BUCKET: BUCKET, S3_ACCESS_KEY_ID: "S3RVER", S3_SECRET_ACCESS_KEY: "S3RVER", S3_ENDPOINT: `http://127.0.0.1:${PORT}`, S3_REGION: "us-east-1" });
  setStorageForTests(undefined);
  storage = getStorage()!;
};
const unconfigure = () => {
  for (const k of ENV) delete process.env[k];
  setStorageForTests(undefined);
};

beforeEach(async () => {
  await db().activityLog.deleteMany({ where: { entityType: { not: "Session" } } });
});

/* ───────────────────────── file detection (pure) ───────────────────────── */
describe("file detection trusts bytes, not names or declared types", () => {
  it("recognises the allowed formats and reads image sizes", () => {
    expect(detectFile(png(40, 30), "png")).toMatchObject({ mime: "image/png", kind: "image", width: 40, height: 30 });
    expect(detectFile(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]), Buffer.from("JFIF\0"), Buffer.alloc(10), Buffer.from([0xff, 0xc0, 0, 11, 8, 0, 20, 0, 30, 3, 1, 0x22, 0, 0, 0]), Buffer.alloc(20)]), "jpg")).toMatchObject({ mime: "image/jpeg", width: 30, height: 20 });
    expect(detectFile(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8X"), Buffer.alloc(8), Buffer.from([9, 0, 0, 4, 0, 0]), Buffer.alloc(8)]), "webp")).toMatchObject({ mime: "image/webp", width: 10, height: 5 });
    expect(detectFile(pdf(), "pdf")).toMatchObject({ mime: "application/pdf", kind: "document" });
    expect(detectFile(Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisom"), Buffer.alloc(20)]), "mp4")).toMatchObject({ mime: "video/mp4", kind: "video" });
  });
  it("rejects scripts, HTML, SVG, executables, empty and unknown archives", () => {
    const cases: [string, Buffer, string][] = [
      ["html", Buffer.from("<html><script>alert(1)</script></html>"), "png"],
      ["svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "svg"],
      ["js", Buffer.from("console.log('hi'); // plenty of bytes here"), "pdf"],
      ["exe", Buffer.concat([Buffer.from("MZ"), Buffer.alloc(40)]), "pdf"],
      ["plain zip", Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("readme.txt"), Buffer.alloc(40)]), "docx"],
      ["tiny", Buffer.from("%PDF"), "pdf"],
    ];
    for (const [, bytes, ext] of cases) expect(detectFile(bytes, ext)).toBeNull();
  });
  it("sanitises display names (no paths or control characters)", () => {
    expect(cleanFileName("../../etc/passwd.png")).toBe("passwd.png");
    expect(cleanFileName("C:\\Windows\\evil<>.pdf")).toBe("evil.pdf");
    expect(cleanFileName("a\u0000b\nc.pdf")).toBe("abc.pdf");
    expect(cleanFileName("..")).toBe("file");
    expect(cleanFileName("x".repeat(500) + ".png").length).toBeLessThanOrEqual(150);
  });
});

/* ───────────────────────── storage not configured ───────────────────────── */
describe("when object storage is NOT configured", () => {
  beforeAll(() => { unconfigure(); });
  it("says so, and never pretends to store or serve anything", async () => {
    expect((await call(storageStatus.GET as H, { url: "/api/storage/status", cookie: ck.sa })).data).toEqual({ configured: false });
    expect((await call(storageStatus.GET as H, { url: "/api/storage/status" })).status).toBe(401);
    const before = { files: await db().storedFile.count(), media: await db().mediaAsset.count(), docs: await db().documentFile.count() };
    const m = await upMedia(ck.uploader, form(file(png(), "a.png", "image/png")));
    expect(m.status).toBe(503);
    expect(m.data.error.code).toBe("storage_not_configured");
    expect((await upDoc(ck.uploader, form(file(pdf(), "a.pdf", "application/pdf"), docFields))).status).toBe(503);
    expect(await db().storedFile.count()).toBe(before.files);
    expect(await db().mediaAsset.count()).toBe(before.media);
    expect(await db().documentFile.count()).toBe(before.docs);
  });
  it("still authorises first: no permission means 403, not a configuration hint", async () => {
    expect((await upMedia(ck.none, form(file(png(), "a.png", "image/png")))).status).toBe(403);
    expect((await upMedia(undefined, form(file(png(), "a.png", "image/png")))).status).toBe(401);
  });
  it("rejects half-configured storage loudly", () => {
    process.env.S3_BUCKET = "b";
    try { expect(() => getStorageConfig()).toThrow(/S3_ACCESS_KEY_ID/); } finally { delete process.env.S3_BUCKET; }
  });
});

/* ───────────────────────── media library against a real S3 API ───────────────────────── */
describe("media library with S3-compatible storage", () => {
  beforeAll(() => { configure(); });

  it("uploads: validates, stores the object privately, records metadata and audits", async () => {
    const bytes = png(40, 30);
    const r = await upMedia(ck.uploader, form(file(bytes, "Brand Logo.png", "image/png"), { folder: "Brand", altText: "Company logo" }));
    expect(r.status, JSON.stringify(r.data)).toBe(201);
    expect(r.data).toMatchObject({ name: "Brand Logo.png", kind: "image", mimeType: "image/png", sizeBytes: bytes.length, width: 40, height: 30, altText: "Company logo", folder: "Brand", uploadedBy: "uploader" });
    expect(r.data.url).toBe(`/api/media/${r.data.id}/file`);
    const row = await db().mediaAsset.findUniqueOrThrow({ where: { id: r.data.id }, include: { file: true } });
    expect(row.file).toMatchObject({ visibility: "private", scanStatus: "pending", kind: "image", originalName: "Brand Logo.png", uploadedById: uid.uploader });
    expect(row.file.storageKey).toMatch(/^media\/\d{4}\/[0-9a-f-]{36}\.png$/); // random key: the name never reaches storage
    expect(row.file.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Number(row.file.sizeBytes)).toBe(bytes.length);
    expect((await objects(storage, row.file.storageKey)).equals(bytes)).toBe(true); // the bytes really are in the bucket
    expect(await db().activityLog.count({ where: { entityId: r.data.id, action: "created" } })).toBe(1);
    expect(JSON.stringify(r.data)).not.toContain(row.file.storageKey);
  });

  it("streams the file only to permitted, signed-in employees, with safe headers", async () => {
    const bytes = png();
    const up = await upMedia(ck.uploader, form(file(bytes, "pic.png", "image/png")));
    const get = (cookie?: string, qs = "") => call(mediaFile.GET as H, { url: `/api/media/${up.data.id}/file${qs}`, cookie, params: { id: up.data.id } });
    const ok = await get(ck.viewer);
    expect(ok.status).toBe(200);
    expect(ok.raw.equals(bytes)).toBe(true);
    expect(ok.headers.get("content-type")).toBe("image/png");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(ok.headers.get("content-security-policy")).toContain("sandbox");
    expect(ok.headers.get("content-disposition")).toBe("inline");
    expect(ok.headers.get("cache-control")).toMatch(/private/);
    expect((await get()).status).toBe(401);
    expect((await get(ck.none)).status).toBe(403);
    expect((await get(ck.viewer, "?download=1")).status).toBe(403); // viewing is not downloading
    const dl = await get(ck.downloader, "?download=1");
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-disposition")).toMatch(/^attachment; filename="pic\.png"/);
    expect((await call(mediaFile.GET as H, { url: "/api/media/nope/file", cookie: ck.viewer, params: { id: "nope" } })).status).toBe(404);
    await db().storedFile.updateMany({ where: { mediaAsset: { id: up.data.id } }, data: { scanStatus: "quarantined" } });
    expect((await get(ck.viewer)).status).toBe(404); // quarantined files are never served
  });

  it("lists, edits metadata and deletes (database rows AND the stored object)", async () => {
    const up = await upMedia(ck.sa, form(file(png(), "to-delete.png", "image/png")));
    const key = (await db().mediaAsset.findUniqueOrThrow({ where: { id: up.data.id }, include: { file: true } })).file.storageKey;
    const list = await call(listRoute.GET as H, { url: "/api/media?search=to-delete", cookie: ck.viewer, params: { resource: "media" } });
    expect(list.data.total).toBe(1);
    expect(list.data.items[0].url).toBe(`/api/media/${up.data.id}/file`);
    const patch = (cookie: string, body: unknown) => call(itemRoute.PATCH as H, { method: "PATCH", url: `/api/media/${up.data.id}`, cookie, body, params: { resource: "media", id: up.data.id } });
    expect((await patch(ck.viewer, { altText: "x" })).status).toBe(403);
    expect((await patch(ck.sa, { altText: "A red square", folder: "Posts" })).data).toMatchObject({ altText: "A red square", folder: "Posts", name: "to-delete.png" });
    expect((await patch(ck.sa, { folder: "../../etc" })).status).toBe(422);
    const del = (cookie: string) => call(itemRoute.DELETE as H, { method: "DELETE", url: `/api/media/${up.data.id}`, cookie, params: { resource: "media", id: up.data.id } });
    expect((await del(ck.uploader)).status).toBe(403);
    expect((await del(ck.sa)).status).toBe(200);
    expect(await db().mediaAsset.count({ where: { id: up.data.id } })).toBe(0);
    expect(await db().storedFile.count({ where: { storageKey: key } })).toBe(0);
    await expect(storage.get(key)).rejects.toMatchObject({ name: "NoSuchKey" });
  });

  it("refuses bad uploads with specific errors and stores nothing", async () => {
    const before = { files: await db().storedFile.count(), assets: await db().mediaAsset.count() };
    const html = file(Buffer.from("<html><script>alert(1)</script></html>"), "x.png", "image/png");
    expect((await upMedia(ck.uploader, form(html))).status).toBe(415);
    expect((await upMedia(ck.uploader, form(file(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "x.svg", "image/svg+xml")))).status).toBe(415);
    const mismatch = await upMedia(ck.uploader, form(file(png(), "x.jpg", "image/jpeg")));
    expect(mismatch.status).toBe(415);
    expect(mismatch.data.error.code).toBe("file_type_mismatch");
    expect((await upMedia(ck.uploader, form(file(pdf(), "x.pdf", "application/pdf")))).status).toBe(415); // documents do not belong in the media library
    expect((await upMedia(ck.uploader, form(file(Buffer.alloc(0), "empty.png", "image/png")))).status).toBe(422);
    expect((await upMedia(ck.uploader, form(null))).status).toBe(422);
    const big = Buffer.concat([png(), Buffer.alloc(5 * 1024 * 1024)]);
    const tooBig = await upMedia(ck.uploader, form(file(big, "big.png", "image/png")));
    expect(tooBig.status).toBe(413);
    expect(tooBig.data.error.code).toBe("file_too_large");
    expect((await upMedia(ck.uploader, form(file(png(), "ok.png", "image/png"), { folder: "Secret" }))).status).toBe(422);
    expect(await db().storedFile.count()).toBe(before.files);
    expect(await db().mediaAsset.count()).toBe(before.assets);
  });

  it("an oversized request is refused from its Content-Length before it is read", async () => {
    const r = await call(mediaUpload.POST as H, { method: "POST", url: "/api/media/upload", cookie: ck.uploader, body: "x", form: form(file(png(), "a.png", "image/png")), headers: { "content-length": String(80 * 1024 * 1024) } });
    expect(r.status).toBe(413);
  });

  it("sanitises a hostile file name", async () => {
    const r = await upMedia(ck.uploader, form(file(png(), "../../etc/passwd.png", "image/png")));
    expect(r.status).toBe(201);
    expect(r.data.name).toBe("passwd.png");
  });

  it("is not a CSRF target: cross-origin multipart uploads are refused", async () => {
    const r = await call(mediaUpload.POST as H, { method: "POST", url: "/api/media/upload", cookie: ck.uploader, body: "x", form: form(file(png(), "a.png", "image/png")), origin: "https://evil.example" });
    expect(r.status).toBe(403);
  });
});

/* ───────────────────────── failure handling: never claim success that did not happen ───────────────────────── */
describe("upload failures are reported honestly", () => {
  beforeAll(() => { configure(); });
  const track = (real: ObjectStorage) => {
    const calls = { put: [] as string[], delete: [] as string[] };
    const wrapped: ObjectStorage = { ...real, put: async (k, b, o) => { calls.put.push(k); await real.put(k, b, o); }, delete: async (k) => { calls.delete.push(k); await real.delete(k); } };
    return { calls, wrapped };
  };

  it("a failing storage write returns 502 and records nothing", async () => {
    const broken: ObjectStorage = { ...storage, put: async () => { throw Object.assign(new Error("connection refused"), { name: "TimeoutError" }); } };
    setStorageForTests(broken);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const before = await db().storedFile.count();
    const r = await upMedia(ck.uploader, form(file(png(), "a.png", "image/png")));
    expect(r.status).toBe(502);
    expect(r.data.error.code).toBe("storage_upload_failed");
    expect(JSON.stringify(r.data)).not.toMatch(/refused|Timeout|127\.0\.0\.1|hv-test/);
    expect(await db().storedFile.count()).toBe(before);
    expect(await db().mediaAsset.count({ where: { name: "a.png" } })).toBe(0);
    vi.restoreAllMocks();
  });

  it("wrong storage credentials fail the same way (no partial state, no secrets in the answer)", async () => {
    setStorageForTests(createS3Storage({ bucket: BUCKET, region: "us-east-1", accessKeyId: "WRONG", secretAccessKey: "WRONGWRONG", endpoint: `http://127.0.0.1:${PORT}`, forcePathStyle: true }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await upMedia(ck.uploader, form(file(png(), "creds.png", "image/png")));
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.data)).not.toMatch(/WRONG|S3RVER/);
    expect(await db().storedFile.count({ where: { originalName: "creds.png" } })).toBe(0);
    vi.restoreAllMocks();
  });

  it("if the database write fails after the object was stored, the object is removed again", async () => {
    const { calls, wrapped } = track(storage);
    setStorageForTests(wrapped);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const spy = vi.spyOn(getDb(), "$transaction").mockRejectedValueOnce(new Error("db down"));
    const r = await upMedia(ck.uploader, form(file(png(), "orphan.png", "image/png")));
    spy.mockRestore();
    expect(r.status).toBe(500);
    expect(calls.put).toHaveLength(1);
    expect(calls.delete).toEqual(calls.put); // compensated
    await expect(storage.get(calls.put[0])).rejects.toMatchObject({ name: "NoSuchKey" });
    expect(await db().storedFile.count({ where: { originalName: "orphan.png" } })).toBe(0);
    vi.restoreAllMocks();
  });

  it("a missing object is a 404/502, never an empty success", async () => {
    setStorageForTests(storage);
    const up = await upMedia(ck.sa, form(file(png(), "gone.png", "image/png")));
    const key = (await db().mediaAsset.findUniqueOrThrow({ where: { id: up.data.id }, include: { file: true } })).file.storageKey;
    await storage.delete(key);
    const r = await call(mediaFile.GET as H, { url: `/api/media/${up.data.id}/file`, cookie: ck.sa, params: { id: up.data.id } });
    expect(r.status).toBe(404);
  });
});

/* ───────────────────────── document library ───────────────────────── */
describe("document library with S3-compatible storage", () => {
  beforeAll(() => { configure(); });

  it("uploads a document, keeps non-public files private, and offers signed downloads only to permitted employees", async () => {
    const bytes = pdf();
    const r = await upDoc(ck.uploader, form(file(bytes, "ISO 9001.pdf", "application/pdf"), docFields));
    expect(r.status, JSON.stringify(r.data)).toBe(201);
    expect(r.data).toMatchObject({ title: "Quality certificate", category: "Certificate", fileName: "ISO 9001.pdf", mimeType: "application/pdf", version: "1.0", visibility: "internal", status: "draft", uploadedBy: "uploader" });
    const row = await db().documentFile.findUniqueOrThrow({ where: { id: r.data.id }, include: { file: true } });
    expect(row.visibility).toBe("private");
    expect(row.file).toMatchObject({ visibility: "private", kind: "document", storageKey: expect.stringMatching(/^documents\/\d{4}\/[0-9a-f-]{36}\.pdf$/) });
    const dl = (cookie?: string) => call(docDownload.GET as H, { url: `/api/documents/${r.data.id}/download`, cookie, params: { id: r.data.id } });
    expect((await dl()).status).toBe(401);
    expect((await dl(ck.none)).status).toBe(403);
    expect((await dl(ck.viewer)).status).toBe(403);
    const ok = await dl(ck.downloader);
    expect(ok.status).toBe(200);
    expect(ok.data.expiresInSeconds).toBe(60);
    const fetched = await fetch(ok.data.url);
    expect(fetched.status).toBe(200);
    expect(Buffer.from(await fetched.arrayBuffer()).equals(bytes)).toBe(true);
    expect(fetched.headers.get("content-disposition")).toMatch(/attachment; filename="ISO 9001\.pdf"/);
    expect(await db().activityLog.count({ where: { entityId: r.data.id, action: "viewed_sensitive" } })).toBe(1); // non-public => audited
    await call(itemRoute.PATCH as H, { method: "PATCH", url: `/api/documents/${r.data.id}`, cookie: ck.sa, body: { visibility: "public" }, params: { resource: "documents", id: r.data.id } });
    expect((await db().documentFile.findUniqueOrThrow({ where: { id: r.data.id }, include: { file: true } })).file.visibility).toBe("public"); // the file mirrors the document
    await dl(ck.downloader);
    expect(await db().activityLog.count({ where: { entityId: r.data.id, action: "viewed_sensitive" } })).toBe(1); // public => not audited again
  });

  it("validates input and permissions before anything is stored", async () => {
    const before = await db().storedFile.count();
    expect((await upDoc(ck.uploader, form(file(pdf(), "a.pdf", "application/pdf"), { ...docFields, title: "" }))).status).toBe(422);
    expect((await upDoc(ck.uploader, form(file(pdf(), "a.pdf", "application/pdf"), { ...docFields, category: "Secrets" }))).status).toBe(422);
    expect((await upDoc(ck.uploader, form(file(png(), "a.png", "image/png"), docFields))).status).toBe(415); // images are not documents
    expect((await upDoc(ck.uploader, form(file(pdf(), "a.pdf", "application/pdf"), { ...docFields, status: "published" }))).status).toBe(403); // no publish right
    expect((await upDoc(ck.viewer, form(file(pdf(), "a.pdf", "application/pdf"), docFields))).status).toBe(403);
    expect((await upDoc(ck.sa, form(file(Buffer.concat([pdf(), Buffer.alloc(10 * 1024 * 1024)]), "big.pdf", "application/pdf"), docFields))).status).toBe(413);
    expect(await db().storedFile.count()).toBe(before);
    const published = await upDoc(ck.sa, form(file(pdf(), "pub.pdf", "application/pdf"), { ...docFields, title: "Published policy", status: "published", visibility: "public" }));
    expect(published.status).toBe(201);
    expect(published.data.visibility).toBe("public");
  });

  it("deleting a document removes the record, the metadata and the object", async () => {
    const r = await upDoc(ck.sa, form(file(pdf(), "del.pdf", "application/pdf"), { ...docFields, title: "Delete me" }));
    const key = (await db().documentFile.findUniqueOrThrow({ where: { id: r.data.id }, include: { file: true } })).file.storageKey;
    const del = await call(itemRoute.DELETE as H, { method: "DELETE", url: `/api/documents/${r.data.id}`, cookie: ck.sa, params: { resource: "documents", id: r.data.id } });
    expect(del.status).toBe(200);
    expect(await db().storedFile.count({ where: { storageKey: key } })).toBe(0);
    await expect(storage.get(key)).rejects.toMatchObject({ name: "NoSuchKey" });
  });
});

/* ───────────────────────── resumes ───────────────────────── */
describe("resume downloads are protected and real", () => {
  beforeAll(() => { configure(); });
  it("needs download permission, returns a short-lived signed link to the stored resume and audits it", async () => {
    const bytes = pdf();
    const key = "resumes/e2e-test.pdf";
    await storage.put(key, bytes, { contentType: "application/pdf" });
    const d = db();
    const career = await d.career.create({ data: { title: "Analyst", slug: "analyst-s", department: "Trade", location: "Mumbai", employmentType: "full_time", experience: "2", descriptionHtml: "<p>d</p>", requirementsHtml: "<p>r</p>", deadline: new Date("2027-01-01") } });
    const stored = await d.storedFile.create({ data: { storageKey: key, originalName: "cv.pdf", mimeType: "application/pdf", sizeBytes: BigInt(bytes.length), kind: "resume", visibility: "private" } });
    const app = await d.jobApplication.create({ data: { careerId: career.id, applicantName: "Rita", email: "r@x.dev", phone: "1", experienceYears: 2, resumeFileId: stored.id } });
    const get = (cookie?: string) => call(resume.GET as H, { url: `/api/applications/${app.id}/resume`, cookie, params: { id: app.id } });
    expect((await get()).status).toBe(401);
    expect((await get(ck.viewer)).status).toBe(403);
    expect((await get(ck.none)).status).toBe(403);
    const ok = await get(ck.downloader);
    expect(ok.status).toBe(200);
    expect(ok.data.url).toMatch(/X-Amz-Signature=/);
    expect(ok.data.url).toMatch(/X-Amz-Expires=60/); // short-lived
    const res = await fetch(ok.data.url);
    expect(Buffer.from(await res.arrayBuffer()).equals(bytes)).toBe(true);
    expect(await d.activityLog.count({ where: { entityId: app.id, action: "viewed_sensitive" } })).toBe(1);
    await d.jobApplication.update({ where: { id: app.id }, data: { anonymizedAt: new Date() } });
    expect((await get(ck.downloader)).status).toBe(404); // erased applicants have nothing to download
  });
});
