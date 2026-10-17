import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { getDb } from "@/server/db";
import { purgeOrphanProductFiles } from "@/server/product-files";
import { call, ensurePermissions, loginCookie, makeRole, makeUser } from "./helpers";
import * as imageUpload from "@/app/api/products/image/route";
import * as documentUpload from "@/app/api/products/document/route";
import * as filePreview from "@/app/api/products/files/[id]/route";
import * as publicImage from "@/app/api/public/product-image/[id]/route";
import { getProduct, listRecentProducts } from "@/server/services/public";
import * as products from "@/app/api/products/route";
import * as productById from "@/app/api/products/[id]/route";

/**
 * Product pictures and documents: uploaded through our own routes, saved inside the project on local disk, attached to a product by
 * file id only, previewed through a permission-checked route, and removed from disk once no product uses them.
 */
type H = Parameters<typeof call>[0];
const db = () => getDb();
const ck: Record<string, string> = {};
let dir = "";
let savedDir: string | undefined;
let categoryId = "";

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

const uploadRaw = (route: "image" | "document", bytes: Buffer, name: string, type: string, cookie: string | null = ck.sa) => {
  const fd = new FormData();
  fd.set("file", new File([new Uint8Array(bytes)], name, { type }));
  const handler = route === "image" ? imageUpload.POST : documentUpload.POST;
  return call(handler as H, { method: "POST", url: `/api/products/${route}`, cookie: cookie ?? undefined, body: "multipart", form: fd });
};
async function upload(route: "image" | "document", bytes: Buffer, name: string, type: string) {
  const r = await uploadRaw(route, bytes, name, type);
  expect(r.status, JSON.stringify(r.data)).toBe(201);
  return r.data as { id: string; url: string; name: string; sizeBytes: number };
}
const body = (over: Record<string, unknown> = {}) => ({
  name: "Iron Ore Fines", code: "IOF-1", slug: "iron-ore-fines", categoryId, shortDescription: "Fines for pelletising and sintering.",
  description: "High grade iron ore fines supplied in bulk for steelmaking.", status: "draft", ...over,
});
const create = (b: Record<string, unknown>, cookie = ck.sa) => call(products.POST as H, { method: "POST", url: "/api/products", cookie, body: b });
const patch = (id: string, b: Record<string, unknown>, cookie = ck.sa) => call(productById.PATCH as H, { method: "PATCH", url: `/api/products/${id}`, cookie, body: b, params: { id } });
const remove = (id: string) => call(productById.DELETE as H, { method: "DELETE", url: `/api/products/${id}`, cookie: ck.sa, params: { id } });
const preview = (id: string, cookie?: string) => call(filePreview.GET as H, { url: `/api/products/files/${id}`, cookie, params: { id } });
const stored = (id: string) => db().storedFile.findUnique({ where: { id } });

beforeAll(async () => {
  savedDir = process.env.PRODUCT_UPLOAD_DIR;
  dir = mkdtempSync(join(tmpdir(), "hv-products-"));
  process.env.PRODUCT_UPLOAD_DIR = dir;
  await ensurePermissions();
  const d = db();
  await d.adminUser.deleteMany();
  await d.role.deleteMany();
  const sa = await makeRole("Super Admin", {}, true);
  const viewer = await makeRole("Product viewer", { products: ["view"] });
  const none = await makeRole("No products", { posts: ["view"] });
  await makeUser("sa@pf.dev", sa.id);
  await makeUser("viewer@pf.dev", viewer.id);
  await makeUser("none@pf.dev", none.id);
  for (const k of ["sa", "viewer", "none"]) ck[k] = await loginCookie(`${k}@pf.dev`);
  await d.product.deleteMany();
  await d.category.deleteMany({ where: { slug: "pf-metals" } });
  categoryId = (await d.category.create({ data: { name: "PF Metals", slug: "pf-metals", description: "x", status: "published" } })).id;
});
afterAll(async () => {
  await db().product.deleteMany();
  await db().storedFile.deleteMany({ where: { storageKey: { startsWith: "products/" } } });
  await db().category.deleteMany({ where: { slug: "pf-metals" } });
  rmSync(dir, { recursive: true, force: true });
  if (savedDir === undefined) delete process.env.PRODUCT_UPLOAD_DIR;
  else process.env.PRODUCT_UPLOAD_DIR = savedDir;
});
beforeEach(async () => {
  await db().product.deleteMany();
  await db().storedFile.deleteMany({ where: { storageKey: { startsWith: "products/" } } });
  for (const f of files()) unlinkSync(join(dir, f));
});

describe("product pictures and documents (stored inside the project)", () => {
  it("saves a picture on local disk, records it, and previews the same bytes to a viewer", async () => {
    const bytes = png(40, 22);
    const up = await upload("image", bytes, "iron.png", "image/png");
    expect(up.url).toBe(`/api/products/files/${up.id}`);
    const row = await stored(up.id);
    expect(row).toMatchObject({ kind: "image", mimeType: "image/png" });
    expect(row!.storageKey).toMatch(/^products\/[0-9a-f-]{36}\.png$/);
    expect(files()).toEqual([row!.storageKey.replace("products/", "")]);
    const view = await preview(up.id, ck.viewer);
    expect(view.status).toBe(200);
    expect(view.raw.equals(bytes)).toBe(true);
    expect(view.headers.get("content-disposition")).toBe("inline");
    expect(view.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("saves a document and serves it as a download", async () => {
    const up = await upload("document", pdf(), "datasheet.pdf", "application/pdf");
    expect(up).toMatchObject({ name: "datasheet.pdf" });
    const view = await preview(up.id, ck.sa);
    expect(view.status).toBe(200);
    expect(view.headers.get("content-disposition")).toContain("attachment");
    expect((await stored(up.id))!.visibility).toBe("private");
  });

  it("refuses wrong kinds of file for each route, and files without permission", async () => {
    expect((await uploadRaw("image", pdf(), "a.pdf", "application/pdf")).status).toBe(415);
    expect((await uploadRaw("image", Buffer.from("<script>alert(1)</script>"), "a.png", "image/png")).status).toBe(415);
    expect((await uploadRaw("document", png(), "a.png", "image/png")).status).toBe(415);
    expect((await uploadRaw("image", png(), "a.png", "image/png", ck.viewer)).status).toBe(403);
    expect((await uploadRaw("image", png(), "a.png", "image/png", null)).status).toBe(401);
    expect(files()).toEqual([]);
    const up = await upload("image", png(), "ok.png", "image/png");
    expect((await preview(up.id, ck.none)).status).toBe(403);
    expect((await preview(up.id)).status).toBe(401);
  });

  it("attaches pictures and documents by file id, exposes them on the product, and keeps exactly one primary picture", async () => {
    const a = await upload("image", png(10, 10), "a.png", "image/png");
    const b = await upload("image", png(12, 12), "b.png", "image/png");
    const d = await upload("document", pdf(), "coa.pdf", "application/pdf");
    const r = await create(body({ images: [{ fileId: a.id, alt: "Lumps" }, { fileId: b.id, alt: "Fines", isPrimary: true }], documents: [{ fileId: d.id, type: "coa" }] }));
    expect(r.status, JSON.stringify(r.data)).toBe(201);
    const p = r.data as { id: string; images: { fileId: string; url: string; alt: string; isPrimary: boolean }[]; documents: { fileId: string; type: string; name: string }[] };
    expect(p.images.map((i) => [i.fileId, i.alt, i.isPrimary])).toEqual([[a.id, "Lumps", false], [b.id, "Fines", true]]);
    expect(p.images[0].url).toBe(`/api/products/files/${a.id}`);
    expect(p.documents).toMatchObject([{ fileId: d.id, type: "coa", name: "coa.pdf" }]);
    // first picture becomes primary when none is marked
    const none = await patch(p.id, { images: [{ fileId: b.id, alt: "Fines" }, { fileId: a.id, alt: "Lumps" }] });
    expect((none.data as { images: { fileId: string; isPrimary: boolean }[] }).images.map((i) => [i.fileId, i.isPrimary])).toEqual([[b.id, true], [a.id, false]]);
    // a save that does not mention pictures leaves them alone
    const renamed = await patch(p.id, { name: "Iron Ore Fines 62" });
    expect((renamed.data as { images: unknown[]; documents: unknown[] }).images).toHaveLength(2);
    expect((renamed.data as { documents: unknown[] }).documents).toHaveLength(1);
  });

  it("rejects file ids that were not uploaded here, the wrong kind, duplicates and more than 8 pictures", async () => {
    const img = await upload("image", png(), "a.png", "image/png");
    const doc = await upload("document", pdf(), "a.pdf", "application/pdf");
    const lib = await db().storedFile.create({ data: { storageKey: "other/x.png", originalName: "x.png", mimeType: "image/png", sizeBytes: BigInt(1), kind: "image", visibility: "public" } });
    const fake = "018f0000-0000-7000-8000-000000000000";
    for (const images of [[{ fileId: fake }], [{ fileId: lib.id }], [{ fileId: doc.id }], [{ fileId: img.id }, { fileId: img.id }]]) {
      expect((await create(body({ images }))).status).toBe(422);
    }
    expect((await create(body({ documents: [{ fileId: img.id }] }))).status).toBe(422);
    expect((await create(body({ images: Array.from({ length: 9 }, () => ({ fileId: img.id })) }))).status).toBe(422);
    expect((await db().product.count())).toBe(0);
    await db().storedFile.delete({ where: { id: lib.id } });
  });

  it("removes files from disk once no product uses them (after the grace period), and never while one does", async () => {
    const a = await upload("image", png(), "a.png", "image/png");
    const b = await upload("image", png(14, 14), "b.png", "image/png");
    const created = await create(body({ images: [{ fileId: a.id }] }));
    const id = (created.data as { id: string }).id;
    const later = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await purgeOrphanProductFiles(db(), new Date()); // inside the grace period: nothing goes
    expect(files()).toHaveLength(2);
    await purgeOrphanProductFiles(db(), later); // b was never attached
    expect(await stored(b.id)).toBeNull();
    expect(files()).toHaveLength(1);
    await patch(id, { images: [] }); // a is taken off the product
    await purgeOrphanProductFiles(db(), later);
    expect(await stored(a.id)).toBeNull();
    expect(files()).toEqual([]);
    const c = await upload("image", png(), "c.png", "image/png");
    const p2 = await create(body({ code: "IOF-2", slug: "iron-two", images: [{ fileId: c.id }] }));
    await remove((p2.data as { id: string }).id); // deleting the product leaves the file orphaned; the next purge deletes it
    await purgeOrphanProductFiles(db(), later);
    expect(await stored(c.id)).toBeNull();
    expect(files()).toEqual([]);
  });
});

describe("website: product pictures and the recent products list", () => {
  const pub = (fileId: string) => call(publicImage.GET as H, { url: `/api/public/product-image/${fileId}`, params: { id: fileId } }); // no cookie: a visitor

  it("serves a picture publicly only while its product is published, and never an unattached or document file", async () => {
    const img = await upload("image", png(20, 12), "pub.png", "image/png");
    const doc = await upload("document", pdf(), "pub.pdf", "application/pdf");
    const loose = await upload("image", png(), "loose.png", "image/png");
    const made = await create(body({ status: "draft", images: [{ fileId: img.id }], documents: [{ fileId: doc.id }] }));
    const id = (made.data as { id: string }).id;
    expect((await pub(img.id)).status).toBe(404); // draft product
    await patch(id, { status: "published" });
    const ok = await pub(img.id);
    expect(ok.status).toBe(200);
    expect(ok.raw.equals(png(20, 12))).toBe(true);
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    const detail = await getProduct("iron-ore-fines");
    expect(detail!.gallery).toEqual([{ url: `/api/public/product-image/${img.id}`, alt: "Iron Ore Fines" }]); // the detail page shows the picture
    expect((await pub(doc.id)).status).toBe(404); // documents are never public
    expect((await pub(loose.id)).status).toBe(404); // not attached to any product
    await patch(id, { status: "archived" });
    expect((await pub(img.id)).status).toBe(404);
  });

  it("lists the newest published products first, with their primary picture, and leaves out drafts", async () => {
    const pic = await upload("image", png(), "p.png", "image/png");
    await create(body({ code: "OLD-1", slug: "old-one", name: "Old one", status: "published" }));
    await new Promise((r) => setTimeout(r, 15));
    await create(body({ code: "NEW-1", slug: "new-one", name: "New one", status: "published", images: [{ fileId: pic.id }] }));
    await create(body({ code: "DRAFT-1", slug: "draft-one", name: "Draft one", status: "draft" }));
    const list = await listRecentProducts(6);
    expect(list.map((p) => p.slug)).toEqual(["new-one", "old-one"]);
    expect(list[0].image).toBe(`/api/public/product-image/${pic.id}`);
    expect(list[1].image).toBeNull();
    expect((await listRecentProducts(1)).map((p) => p.slug)).toEqual(["new-one"]);
  });
});
