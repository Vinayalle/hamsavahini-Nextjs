import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { getDb } from "@/server/db";
import { getHeroSlides } from "@/server/services/site";
import { call, ensurePermissions, loginCookie, makeRole, makeUser } from "./helpers";
import * as bannerUpload from "@/app/api/banners/image/route";
import * as bannerPreview from "@/app/api/banners/image/[id]/route";
import * as bannerImage from "@/app/api/public/banner-image/[id]/route";
import * as listRoute from "@/app/api/[resource]/route";
import * as itemRoute from "@/app/api/[resource]/[id]/route";
import * as bulkRoute from "@/app/api/[resource]/bulk/route";

/**
 * The home-page hero: what editors can put in a banner (title, description, image, link), where the picture is kept (inside the
 * project, on local disk), and what the PUBLIC website may see of it. Public output is limited to banners that are published,
 * of section "hero", and inside their schedule window. Deleting a banner deletes its picture.
 */
type H = Parameters<typeof call>[0];
const db = () => getDb();
const ck: Record<string, string> = {};
let dir = "";
let savedDir: string | undefined;

function png(width = 16, height = 9): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); ihdr.write("IHDR", 4); ihdr.writeUInt32BE(width, 8); ihdr.writeUInt32BE(height, 12); ihdr[16] = 8; ihdr[17] = 2;
  const idat = deflateSync(Buffer.alloc((width * 3 + 1) * height));
  const idatChunk = Buffer.concat([Buffer.from([0, 0, 0, idat.length]), Buffer.from("IDAT"), idat, Buffer.alloc(4)]);
  return Buffer.concat([sig, ihdr, idatChunk, Buffer.from([0, 0, 0, 0]), Buffer.from("IEND"), Buffer.alloc(4)]);
}
const pdf = () => Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
const files = () => readdirSync(dir);

const uploadRaw = (bytes: Buffer, name: string, type: string, cookie: string | null = ck.sa) => {
  const fd = new FormData();
  fd.set("file", new File([new Uint8Array(bytes)], name, { type }));
  return call(bannerUpload.POST as H, { method: "POST", url: "/api/banners/image", cookie: cookie ?? undefined, body: "multipart", form: fd });
};
async function upload(bytes: Buffer, name: string, type = "image/png") {
  const r = await uploadRaw(bytes, name, type);
  expect(r.status, JSON.stringify(r.data)).toBe(201);
  return r.data as { id: string; url: string };
}
const bannerBody = (over: Record<string, unknown> = {}) => ({ title: "Enhancing Value Ensuring Quality", subtitle: "We have the expertise and experience to deliver.", section: "hero", ctaLabel: "Know more", ctaUrl: "/about", sortOrder: 1, status: "published", ...over });
const createBanner = (body: Record<string, unknown>, cookie = ck.sa) => call(listRoute.POST as H, { method: "POST", url: "/api/banners", cookie, body, params: { resource: "banners" } });
const patchBanner = (id: string, body: Record<string, unknown>) => call(itemRoute.PATCH as H, { method: "PATCH", url: `/api/banners/${id}`, cookie: ck.sa, body, params: { resource: "banners", id } });
const deleteBanner = (id: string) => call(itemRoute.DELETE as H, { method: "DELETE", url: `/api/banners/${id}`, cookie: ck.sa, params: { resource: "banners", id } });
const publicImage = (id: string) => call(bannerImage.GET as H, { url: `/api/public/banner-image/${id}`, params: { id } }); // no cookie: the website visitor
const preview = (id: string, cookie?: string) => call(bannerPreview.GET as H, { url: `/api/banners/image/${id}`, cookie, params: { id } });
const day = (offset: number) => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + offset));
};
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const stored = (id: string) => db().storedFile.findUnique({ where: { id } });

beforeAll(async () => {
  savedDir = process.env.BANNER_UPLOAD_DIR;
  dir = mkdtempSync(join(tmpdir(), "hv-banners-"));
  process.env.BANNER_UPLOAD_DIR = dir;
  await ensurePermissions();
  const d = db();
  await d.adminUser.deleteMany();
  await d.role.deleteMany();
  const sa = await makeRole("Super Admin", {}, true);
  const noBanners = await makeRole("No banners", { posts: ["view"] });
  const viewer = await makeRole("Banner viewer", { banners: ["view"] });
  const editor = await makeRole("Banner editor", { banners: ["view", "create", "edit", "delete"] });
  await makeUser("sa@h.dev", sa.id);
  await makeUser("none@h.dev", noBanners.id);
  await makeUser("viewer@h.dev", viewer.id);
  await makeUser("editor@h.dev", editor.id);
  for (const k of ["sa", "none", "viewer", "editor"]) ck[k] = await loginCookie(`${k}@h.dev`);
});
afterAll(async () => {
  // Tests share one database: leave no banners or banner pictures behind for the next suite.
  await db().banner.deleteMany();
  await db().storedFile.deleteMany({ where: { storageKey: { startsWith: "banners/" } } });
  await db().storedFile.deleteMany({ where: { storageKey: { startsWith: "other/" } } });
  rmSync(dir, { recursive: true, force: true });
  if (savedDir === undefined) delete process.env.BANNER_UPLOAD_DIR;
  else process.env.BANNER_UPLOAD_DIR = savedDir;
});
beforeEach(async () => {
  await db().banner.deleteMany();
  await db().storedFile.deleteMany({ where: { storageKey: { startsWith: "banners/" } } });
  for (const f of files()) unlinkSync(join(dir, f));
});

describe("banner picture upload (stored inside the project)", () => {
  it("saves a valid image on local disk and records it; the preview returns the same bytes", async () => {
    const bytes = png(40, 22);
    const up = await upload(bytes, "hero.png");
    expect(up.url).toBe(`/api/banners/image/${up.id}`);
    const row = await stored(up.id);
    expect(row).toMatchObject({ kind: "image", mimeType: "image/png", visibility: "public" });
    expect(row!.storageKey).toMatch(/^banners\/[0-9a-f-]{36}\.png$/);
    expect(files()).toEqual([row!.storageKey.replace("banners/", "")]);
    const view = await preview(up.id, ck.viewer);
    expect(view.status).toBe(200);
    expect(view.raw.equals(bytes)).toBe(true);
    expect(view.headers.get("x-content-type-options")).toBe("nosniff");
    expect(view.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
  });

  it("refuses anything that is not a real image, however it is named", async () => {
    const cases: [string, Buffer, string][] = [
      ["page.png", Buffer.from("<html><script>alert(1)</script></html>"), "image/png"],
      ["logo.svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "image/svg+xml"],
      ["doc.png", pdf(), "image/png"],
      ["evil.png", Buffer.concat([Buffer.from("MZ"), Buffer.alloc(60)]), "image/png"],
    ];
    for (const [name, bytes, type] of cases) expect((await uploadRaw(bytes, name, type)).status, name).toBe(415);
    expect((await uploadRaw(Buffer.alloc(0), "empty.png", "image/png")).status).toBe(422);
    expect((await uploadRaw(png(), "hero.png", "image/jpeg")).status).toBe(415); // declared type does not match the content
    expect(files()).toEqual([]);
    expect(await db().storedFile.count({ where: { storageKey: { startsWith: "banners/" } } })).toBe(0);
  });

  it("refuses pictures above 5 MB before saving anything", async () => {
    const big = Buffer.concat([png(), Buffer.alloc(5 * 1024 * 1024)]);
    const r = await uploadRaw(big, "big.png", "image/png");
    expect(r.status).toBe(413);
    expect(files()).toEqual([]);
  });

  it("needs a session and the right to create or edit banners", async () => {
    expect((await uploadRaw(png(), "a.png", "image/png", null)).status).toBe(401);
    expect((await uploadRaw(png(), "a.png", "image/png", ck.none)).status).toBe(403);
    expect((await uploadRaw(png(), "a.png", "image/png", ck.viewer)).status).toBe(403);
    expect((await uploadRaw(png(), "a.png", "image/png", ck.editor)).status).toBe(201);
    expect(files()).toHaveLength(1);
  });

  it("the admin preview needs a session and banners:view; it only serves banner pictures", async () => {
    const up = await upload(png(), "p.png");
    expect((await preview(up.id)).status).toBe(401);
    expect((await preview(up.id, ck.none)).status).toBe(403);
    expect((await preview(up.id, ck.viewer)).status).toBe(200);
    expect((await preview("nope", ck.sa)).status).toBe(404);
    // a different kind of stored file can never be read through this route
    const other = await db().storedFile.create({ data: { storageKey: "other/secret.pdf", originalName: "secret.pdf", mimeType: "application/pdf", sizeBytes: BigInt(10), kind: "document", visibility: "private", scanStatus: "pending" } });
    expect((await preview(other.id, ck.sa)).status).toBe(404);
  });
});

describe("banner fields: title, description, image, link", () => {
  it("creates a banner with an uploaded image and returns it to the admin", async () => {
    const up = await upload(png(), "hero.png");
    const r = await createBanner(bannerBody({ imageFileId: up.id }));
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ title: "Enhancing Value Ensuring Quality", subtitle: "We have the expertise and experience to deliver.", ctaUrl: "/about", imageFileId: up.id, imageUrl: `/api/banners/image/${up.id}` });
    const listed = await call(listRoute.GET as H, { url: "/api/banners", cookie: ck.viewer, params: { resource: "banners" } });
    expect(listed.data.items[0]).toMatchObject({ imageFileId: up.id, imageUrl: `/api/banners/image/${up.id}` });
  });

  it("button label defaults to 'Know more'; the image is optional", async () => {
    const withoutLabel: Record<string, unknown> = bannerBody();
    delete withoutLabel.ctaLabel;
    const r = await createBanner(withoutLabel);
    expect(r.status).toBe(201);
    expect(r.data.ctaLabel).toBe("Know more");
    expect(r.data.imageFileId).toBeNull();
  });

  it("without a slide order the new banner goes after the existing ones", async () => {
    const make = async (title: string) => {
      const body: Record<string, unknown> = bannerBody({ title });
      delete body.sortOrder;
      return (await createBanner(body)).data.sortOrder as number;
    };
    expect(await make("First slide")).toBe(1);
    expect(await make("Second slide")).toBe(2);
    expect((await createBanner(bannerBody({ title: "Pinned", sortOrder: 10 }))).data.sortOrder).toBe(10);
    expect(await make("After pinned")).toBe(11);
  });

  it("refuses images that are unknown, malformed, or not banner pictures", async () => {
    const doc = await db().storedFile.create({ data: { storageKey: "other/policy.pdf", originalName: "policy.pdf", mimeType: "application/pdf", sizeBytes: BigInt(10), kind: "document", visibility: "private", scanStatus: "pending" } });
    const libraryImage = await db().storedFile.create({ data: { storageKey: "other/library.png", originalName: "library.png", mimeType: "image/png", sizeBytes: BigInt(10), kind: "image", visibility: "private", scanStatus: "pending" } });
    for (const imageFileId of ["3b5e1c92-8a3f-4c1d-9d0a-0d7d3a8f1b11", "not-an-id", doc.id, libraryImage.id]) {
      const r = await createBanner(bannerBody({ imageFileId }));
      expect(r.status, String(imageFileId)).toBe(422);
      expect(r.data.error.fields).toHaveProperty("imageFileId");
    }
    expect(await db().banner.count()).toBe(0);
  });

  it("only accepts a same-site path or an http(s) URL as the link", async () => {
    for (const ctaUrl of ["//evil.example/phish", "javascript:alert(1)", "data:text/html,x", "ftp://x.test/f", "about"]) {
      const r = await createBanner(bannerBody({ ctaUrl }));
      expect(r.status, ctaUrl).toBe(422);
      expect(r.data.error.fields).toHaveProperty("ctaUrl");
    }
    for (const ctaUrl of ["/products", "https://example.com/x"]) expect((await createBanner(bannerBody({ ctaUrl }))).status).toBe(201);
  });

  it("a patch keeps the image unless told otherwise; null removes it; another image replaces it", async () => {
    const a = await upload(png(16, 9), "a.png");
    const b = await upload(png(32, 18), "b.png");
    const id = (await createBanner(bannerBody({ imageFileId: a.id }))).data.id as string;
    expect((await patchBanner(id, { title: "New title here" })).data).toMatchObject({ title: "New title here", imageFileId: a.id, status: "published" });
    expect((await patchBanner(id, { imageFileId: b.id })).data.imageFileId).toBe(b.id);
    const cleared = await patchBanner(id, { imageFileId: null });
    expect(cleared.status).toBe(200);
    expect(cleared.data.imageFileId).toBeNull();
    expect((await patchBanner(id, { imageFileId: "3b5e1c92-8a3f-4c1d-9d0a-0d7d3a8f1b11" })).status).toBe(422);
  });

  it("is permission-checked: no banners rights means no create, view-only means no create", async () => {
    expect((await createBanner(bannerBody(), ck.none)).status).toBe(403);
    expect((await createBanner(bannerBody(), ck.viewer)).status).toBe(403);
    expect((await call(listRoute.GET as H, { url: "/api/banners", cookie: ck.none, params: { resource: "banners" } })).status).toBe(403);
    expect(await db().banner.count()).toBe(0);
  });
});

describe("deleting a banner deletes its picture", () => {
  it("removes the file from disk and its record", async () => {
    const up = await upload(png(), "gone.png");
    const key = (await stored(up.id))!.storageKey;
    const id = (await createBanner(bannerBody({ imageFileId: up.id }))).data.id as string;
    expect(files()).toHaveLength(1);
    expect((await deleteBanner(id)).status).toBeLessThan(300);
    expect(files()).toEqual([]);
    expect(existsSync(join(dir, key.replace("banners/", "")))).toBe(false);
    expect(await stored(up.id)).toBeNull();
    expect((await publicImage(id)).status).toBe(404);
  });

  it("bulk delete removes every picture too", async () => {
    const ids: string[] = [];
    for (const n of ["one", "two", "three"]) {
      const up = await upload(png(16 + ids.length, 9), `${n}.png`);
      ids.push((await createBanner(bannerBody({ title: `Bulk ${n}`, imageFileId: up.id }))).data.id as string);
    }
    expect(files()).toHaveLength(3);
    const r = await call(bulkRoute.POST as H, { method: "POST", url: "/api/banners/bulk", cookie: ck.sa, body: { action: "delete", ids }, params: { resource: "banners" } });
    expect(r.status, JSON.stringify(r.data)).toBeLessThan(300);
    expect(await db().banner.count()).toBe(0);
    expect(files()).toEqual([]);
    expect(await db().storedFile.count({ where: { storageKey: { startsWith: "banners/" } } })).toBe(0);
  });

  it("a picture shared by two banners stays until the last of them is deleted", async () => {
    const up = await upload(png(), "shared.png");
    const a = (await createBanner(bannerBody({ title: "Shared A", imageFileId: up.id }))).data.id as string;
    const b = (await createBanner(bannerBody({ title: "Shared B", imageFileId: up.id }))).data.id as string;
    await deleteBanner(a);
    expect(files()).toHaveLength(1);
    expect(await stored(up.id)).not.toBeNull();
    await deleteBanner(b);
    expect(files()).toEqual([]);
  });

  it("a user who may delete banners can do it; one who may not, cannot (and the picture stays)", async () => {
    const up = await upload(png(), "keep.png");
    const id = (await createBanner(bannerBody({ imageFileId: up.id }))).data.id as string;
    const denied = await call(itemRoute.DELETE as H, { method: "DELETE", url: `/api/banners/${id}`, cookie: ck.viewer, params: { resource: "banners", id } });
    expect(denied.status).toBe(403);
    expect(files()).toHaveLength(1);
    expect((await call(itemRoute.DELETE as H, { method: "DELETE", url: `/api/banners/${id}`, cookie: ck.editor, params: { resource: "banners", id } })).status).toBeLessThan(300);
    expect(files()).toEqual([]);
  });

  it("uploaded-but-never-saved and replaced pictures are swept up after an hour; fresh ones are kept", async () => {
    const unused = await upload(png(20, 10), "unused.png");
    const fresh = await upload(png(21, 10), "fresh.png");
    const a = await upload(png(22, 10), "old-picture.png");
    const b = await upload(png(23, 10), "new-picture.png");
    const id = (await createBanner(bannerBody({ imageFileId: a.id }))).data.id as string;
    await patchBanner(id, { imageFileId: b.id }); // `a` is now replaced and unused
    const longAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await db().storedFile.updateMany({ where: { id: { in: [unused.id, a.id] } }, data: { createdAt: longAgo } });
    await upload(png(24, 10), "trigger.png"); // any upload runs the housekeeping
    await new Promise((r) => setTimeout(r, 300));
    expect(await stored(unused.id)).toBeNull();
    expect(await stored(a.id)).toBeNull();
    expect(await stored(fresh.id)).not.toBeNull(); // within the one-hour grace period
    expect(await stored(b.id)).not.toBeNull(); // in use
    expect(files()).toHaveLength(3); // fresh, b (in use) and the trigger upload
  });
});

describe("what the public website receives (getHeroSlides)", () => {
  it("returns only published hero banners inside their schedule, in slide order", async () => {
    const up = await upload(png(), "p.png");
    const mk = async (over: Record<string, unknown>) => (await createBanner(bannerBody(over))).data.id as string;
    const second = await mk({ title: "Second slide", sortOrder: 2, imageFileId: up.id });
    const first = await mk({ title: "First slide", sortOrder: 1 });
    const endsToday = await mk({ title: "Ends today", sortOrder: 3, endsAt: ymd(day(0)) });
    await mk({ title: "Draft", status: "draft" });
    await mk({ title: "Archived", status: "archived" });
    await mk({ title: "Promo strip", section: "promo" });
    await mk({ title: "Future", startsAt: ymd(day(2)) });
    await mk({ title: "Expired", endsAt: ymd(day(-1)) });
    const slides = await getHeroSlides();
    expect(slides.map((s) => s.title)).toEqual(["First slide", "Second slide", "Ends today"]);
    expect(slides.map((s) => s.id)).toEqual([first, second, endsToday]);
    expect(slides[1].imageUrl).toMatch(new RegExp(`^/api/public/banner-image/${second}\\?v=\\d+$`));
    expect(slides[0].imageUrl).toBeNull();
  });

  it("exposes only title, description, image URL and link, never internals", async () => {
    await createBanner(bannerBody({ ctaLabel: "Explore minerals", ctaUrl: "https://example.com/minerals" }));
    const [slide] = await getHeroSlides();
    expect(Object.keys(slide).sort()).toEqual(["description", "id", "imageUrl", "linkLabel", "linkUrl", "title"]);
    expect(slide).toMatchObject({ description: "We have the expertise and experience to deliver.", linkLabel: "Explore minerals", linkUrl: "https://example.com/minerals" });
    expect(JSON.stringify(slide)).not.toMatch(/storageKey|imageFileId|sha256|createdAt|status/);
  });

  it("caps the slider at 8 slides and returns an empty list when nothing is published", async () => {
    expect(await getHeroSlides()).toEqual([]);
    for (let i = 1; i <= 10; i++) await createBanner(bannerBody({ title: `Slide ${i}`, sortOrder: i }));
    expect(await getHeroSlides()).toHaveLength(8);
  });

  it("an unpublish in the dashboard removes the slide immediately", async () => {
    const id = (await createBanner(bannerBody())).data.id as string;
    expect(await getHeroSlides()).toHaveLength(1);
    await patchBanner(id, { status: "draft" });
    expect(await getHeroSlides()).toHaveLength(0);
  });
});

describe("public banner image route", () => {
  it("serves a live banner's picture to anyone, with locked-down headers", async () => {
    const bytes = png(40, 22);
    const up = await upload(bytes, "wide.png");
    const id = (await createBanner(bannerBody({ imageFileId: up.id }))).data.id as string;
    const r = await publicImage(id);
    expect(r.status).toBe(200);
    expect(r.raw.equals(bytes)).toBe(true);
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(r.headers.get("cache-control")).toMatch(/^public/);
    expect(r.headers.get("set-cookie")).toBeNull();
  });

  it("answers 404 for anything that is not a live hero banner with a picture", async () => {
    const up = await upload(png(), "x.png");
    const mk = async (over: Record<string, unknown>) => (await createBanner(bannerBody({ imageFileId: up.id, ...over }))).data.id as string;
    const cases: Record<string, string> = {
      draft: await mk({ status: "draft" }),
      archived: await mk({ status: "archived" }),
      promo: await mk({ section: "promo" }),
      future: await mk({ startsAt: ymd(day(3)) }),
      expired: await mk({ endsAt: ymd(day(-2)) }),
      noPicture: (await createBanner(bannerBody())).data.id as string,
    };
    for (const [name, id] of Object.entries(cases)) expect((await publicImage(id)).status, name).toBe(404);
    for (const id of ["nope", "../../etc/passwd", "3b5e1c92-8a3f-4c1d-9d0a-0d7d3a8f1b11"]) expect((await publicImage(id)).status, id).toBe(404);
  });

  it("a file id is not a banner id", async () => {
    const up = await upload(png(), "private.png");
    expect((await publicImage(up.id)).status).toBe(404);
  });

  it("if the file is missing on disk the picture is a 404 and the slide still shows", async () => {
    const up = await upload(png(), "s.png");
    const id = (await createBanner(bannerBody({ imageFileId: up.id }))).data.id as string;
    for (const f of files()) unlinkSync(join(dir, f));
    expect((await publicImage(id)).status).toBe(404);
    expect(await getHeroSlides()).toHaveLength(1);
  });

  it("stops serving as soon as the banner is unpublished", async () => {
    const up = await upload(png(), "u.png");
    const id = (await createBanner(bannerBody({ imageFileId: up.id }))).data.id as string;
    expect((await publicImage(id)).status).toBe(200);
    await patchBanner(id, { status: "draft" });
    expect((await publicImage(id)).status).toBe(404);
  });
});
