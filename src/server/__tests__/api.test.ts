import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db";
import { hashToken } from "@/server/security";
import { PASSWORD, call, ensurePermissions, loginCookie, makeRole, makeUser } from "./helpers";
import * as login from "@/app/api/auth/login/route";
import * as logout from "@/app/api/auth/logout/route";
import * as me from "@/app/api/auth/me/route";
import * as products from "@/app/api/products/route";
import * as productById from "@/app/api/products/[id]/route";
import * as productsBulk from "@/app/api/products/bulk/route";
import * as categories from "@/app/api/categories/route";
import * as categoryById from "@/app/api/categories/[id]/route";
import * as categoriesBulk from "@/app/api/categories/bulk/route";

let admin = "";
let viewer = "";
let editor = "";
let noAccess = "";

const productBody = (categoryId: string, over: Record<string, unknown> = {}) => ({
  name: "Test Copper Wire", code: "hmv-tst-0001", slug: "test-copper-wire", categoryId,
  shortDescription: "High purity copper wire for testing.", description: "Full description of the test copper wire product for QA.",
  specifications: [{ label: "Purity", value: "99.9", unit: "%" }], seo: { metaTitle: "Test", metaDescription: "Test", keywords: ["wire"] },
  status: "draft", featured: false, ...over,
});

async function makeCategory(cookie = admin, over: Record<string, unknown> = {}) {
  const r = await call(categories.POST, { method: "POST", url: "/api/categories", cookie, body: { name: "Metals", slug: "metals", status: "published", ...over } });
  expect(r.status).toBe(201);
  return r.data as { id: string };
}

beforeAll(async () => {
  await ensurePermissions();
  const db = getDb();
  await db.adminUser.deleteMany();
  await db.role.deleteMany();
  const sa = await makeRole("Super Admin", {}, true);
  const vw = await makeRole("Viewer", { products: ["view"], categories: ["view"] });
  const ed = await makeRole("Editor", { products: ["view", "create", "edit"], categories: ["view", "create", "edit"] });
  const na = await makeRole("NoAccess", {});
  await makeUser("admin@test.dev", sa.id);
  await makeUser("viewer@test.dev", vw.id);
  await makeUser("editor@test.dev", ed.id);
  await makeUser("noaccess@test.dev", na.id);
  await makeUser("suspended@test.dev", sa.id, "suspended");
  await makeUser("invited@test.dev", sa.id, "invited");
  admin = await loginCookie("admin@test.dev");
  viewer = await loginCookie("viewer@test.dev");
  editor = await loginCookie("editor@test.dev");
  noAccess = await loginCookie("noaccess@test.dev");
});

beforeEach(async () => {
  const db = getDb();
  await db.activityLog.deleteMany({ where: { entityType: { in: ["Product", "Category"] } } });
  await db.product.deleteMany();
  await db.category.deleteMany();
});

describe("partial updates", () => {
  it("changing one product field leaves status, featured, specifications and SEO as they were", async () => {
    const cat = await makeCategory();
    const made = await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, body: productBody(cat.id, { code: "hmv-ptc-0001", slug: "patch-check", status: "published", featured: true, seo: { metaTitle: "Keep me", metaDescription: "Keep me too", keywords: ["a"] } }) });
    expect(made.status, JSON.stringify(made.data)).toBe(201);
    const r = await call(productById.PATCH, { method: "PATCH", url: `/api/products/${made.data.id}`, cookie: admin, body: { name: "Renamed only" }, params: { id: made.data.id } });
    expect(r.status).toBe(200);
    expect(r.data.name).toBe("Renamed only");
    expect(r.data.status).toBe("published");
    expect(r.data.featured).toBe(true);
    expect(r.data.specifications).toHaveLength(1);
    expect(r.data.seo.metaTitle).toBe("Keep me");
    const f = await call(productById.PATCH, { method: "PATCH", url: `/api/products/${made.data.id}`, cookie: admin, body: { featured: false }, params: { id: made.data.id } });
    expect(f.data.status).toBe("published");
  });
  it("changing one category field leaves its status, parent and order alone", async () => {
    const parent = await makeCategory(admin, { name: "Parent", slug: "parent-p" });
    const child = await makeCategory(admin, { name: "Child", slug: "child-p", parentId: parent.id, sortOrder: 5, status: "published", description: "Keep this" });
    const r = await call(categoryById.PATCH, { method: "PATCH", url: `/api/categories/${child.id}`, cookie: admin, body: { name: "Child renamed" }, params: { id: child.id } });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ name: "Child renamed", status: "published", parentId: parent.id, sortOrder: 5, description: "Keep this" });
  });
});

describe("authentication", () => {
  it("sets HttpOnly cookies, keeps the refresh token path-scoped, and stores only a hash of it", async () => {
    const r = await call(login.POST, { method: "POST", url: "/api/auth/login", body: { email: "VIEWER@test.dev", password: PASSWORD } });
    expect(r.status).toBe(200);
    expect(r.data.status).toBe("authenticated");
    const lines = r.headers.getSetCookie();
    const at = lines.find((l) => l.startsWith("hv_at="))!;
    const rt = lines.find((l) => l.startsWith("hv_rt="))!;
    expect(at).toMatch(/HttpOnly/);
    expect(at).toMatch(/SameSite=Lax/);
    expect(rt).toMatch(/HttpOnly/);
    expect(rt).toMatch(/SameSite=Strict/);
    expect(rt).toMatch(/Path=\/api\/auth/);
    const refreshToken = decodeURIComponent(rt.split(";")[0].split("=")[1]);
    const db = getDb();
    expect(await db.refreshToken.findUnique({ where: { tokenHash: refreshToken } })).toBeNull(); // raw token is never stored
    expect(await db.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } })).not.toBeNull();
    expect(JSON.stringify(r.data)).not.toMatch(/passwordHash|argon2|hv_at|eyJ/);
  });

  it("stores timestamps at the correct instant regardless of the database server's time zone", async () => {
    await loginCookie("viewer@test.dev");
    const [row] = await getDb().$queryRaw<{ skew: number }[]>`SELECT abs(extract(epoch from (now() - "createdAt")))::float AS skew FROM "Session" ORDER BY "createdAt" DESC LIMIT 1`;
    expect(row.skew).toBeLessThan(30); // a time-zone mix-up shows up as hours
    const [exp] = await getDb().$queryRaw<{ ahead: number }[]>`SELECT extract(epoch from ("expiresAt" - now()))::float AS ahead FROM "Session" ORDER BY "createdAt" DESC LIMIT 1`;
    expect(exp.ahead).toBeGreaterThan(23 * 3600);
    expect(exp.ahead).toBeLessThan(24 * 3600 + 60);
  });

  it("returns the same generic error for a wrong password and an unknown account", async () => {
    const bad = await call(login.POST, { method: "POST", url: "/api/auth/login", body: { email: "admin@test.dev", password: "nope-nope-nope" } });
    const unknown = await call(login.POST, { method: "POST", url: "/api/auth/login", body: { email: "ghost@test.dev", password: "nope-nope-nope" } });
    expect(bad.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(bad.data.error.message).toBe(unknown.data.error.message);
  });

  it("refuses suspended and invited accounts even with the right password", async () => {
    for (const email of ["suspended@test.dev", "invited@test.dev"]) {
      const r = await call(login.POST, { method: "POST", url: "/api/auth/login", body: { email, password: PASSWORD } });
      expect(r.status).toBe(401);
    }
  });

  it("locks an account after repeated failures and records audit entries", async () => {
    const db = getDb();
    const role = await db.role.findFirstOrThrow({ where: { name: "NoAccess" } });
    await makeUser("lock@test.dev", role.id);
    for (let i = 0; i < 5; i++) await call(login.POST, { method: "POST", url: "/api/auth/login", body: { email: "lock@test.dev", password: "wrong-password-1" } });
    const afterLock = await call(login.POST, { method: "POST", url: "/api/auth/login", body: { email: "lock@test.dev", password: PASSWORD } });
    expect(afterLock.status).toBe(401); // correct password is refused while locked
    expect(await db.activityLog.count({ where: { action: "login_failed", entityLabel: "lock@test.dev" } })).toBeGreaterThanOrEqual(5);
  });

  it("/me requires a session, returns permissions, and logout revokes it server-side", async () => {
    expect((await call(me.GET, { url: "/api/auth/me" })).status).toBe(401);
    const cookie = await loginCookie("editor@test.dev");
    const ok = await call(me.GET, { url: "/api/auth/me", cookie });
    expect(ok.status).toBe(200);
    expect(ok.data.permissions).toContain("products:edit");
    expect(ok.data.permissions).not.toContain("products:delete");
    await call(logout.POST, { method: "POST", url: "/api/auth/logout", cookie, body: {} });
    expect((await call(me.GET, { url: "/api/auth/me", cookie })).status).toBe(401); // cookie replay fails
  });

  it("rejects an expired session", async () => {
    const db = getDb();
    const role = await db.role.findFirstOrThrow({ where: { name: "Viewer" } });
    const u = await makeUser("expiring@test.dev", role.id);
    const cookie = await loginCookie("expiring@test.dev");
    expect((await call(me.GET, { url: "/api/auth/me", cookie })).status).toBe(200);
    await db.session.updateMany({ where: { userId: u.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await call(me.GET, { url: "/api/auth/me", cookie })).status).toBe(401);
  });

  it("invalidates a live session when the user is suspended", async () => {
    const db = getDb();
    const role = await db.role.findFirstOrThrow({ where: { name: "Viewer" } });
    const u = await makeUser("soon-suspended@test.dev", role.id);
    const cookie = await loginCookie("soon-suspended@test.dev");
    expect((await call(me.GET, { url: "/api/auth/me", cookie })).status).toBe(200);
    await db.adminUser.update({ where: { id: u.id }, data: { status: "suspended" } });
    expect((await call(me.GET, { url: "/api/auth/me", cookie })).status).toBe(401);
  });

  it("blocks cross-origin and non-JSON mutations (CSRF defence)", async () => {
    const evil = await call(login.POST, { method: "POST", url: "/api/auth/login", origin: "https://evil.example", body: { email: "admin@test.dev", password: PASSWORD } });
    expect(evil.status).toBe(403);
    const noOrigin = await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, origin: null, body: {} });
    expect(noOrigin.status).toBe(403);
    const form = await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, contentType: "application/x-www-form-urlencoded", body: "a=1" });
    expect(form.status).toBe(415);
  });
});

describe("authorization (server-side RBAC)", () => {
  it("returns 401 on every products/categories route without a session", async () => {
    const id = "0194b0e0-0000-7000-8000-000000000000";
    const calls = [
      call(products.GET, { url: "/api/products" }),
      call(products.POST, { method: "POST", url: "/api/products", body: {} }),
      call(productById.GET, { url: `/api/products/${id}`, params: { id } }),
      call(productById.PATCH, { method: "PATCH", url: `/api/products/${id}`, params: { id }, body: {} }),
      call(productById.DELETE, { method: "DELETE", url: `/api/products/${id}`, params: { id } }),
      call(productsBulk.POST, { method: "POST", url: "/api/products/bulk", body: {} }),
      call(categories.GET, { url: "/api/categories" }),
      call(categories.POST, { method: "POST", url: "/api/categories", body: {} }),
      call(categoryById.DELETE, { method: "DELETE", url: `/api/categories/${id}`, params: { id } }),
      call(categoriesBulk.POST, { method: "POST", url: "/api/categories/bulk", body: {} }),
    ];
    for (const r of await Promise.all(calls)) expect(r.status).toBe(401);
  });

  it("a view-only role can read but cannot create, edit, delete or bulk-change", async () => {
    const cat = await makeCategory();
    const p = await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, body: productBody(cat.id) });
    const id = p.data.id as string;
    expect((await call(products.GET, { url: "/api/products", cookie: viewer })).status).toBe(200);
    expect((await call(productById.GET, { url: `/api/products/${id}`, params: { id }, cookie: viewer })).status).toBe(200);
    expect((await call(products.POST, { method: "POST", url: "/api/products", cookie: viewer, body: productBody(cat.id, { code: "HMV-TST-0002", slug: "x-2" }) })).status).toBe(403);
    expect((await call(productById.PATCH, { method: "PATCH", url: `/api/products/${id}`, params: { id }, cookie: viewer, body: { name: "Hacked" } })).status).toBe(403);
    expect((await call(productById.DELETE, { method: "DELETE", url: `/api/products/${id}`, params: { id }, cookie: viewer })).status).toBe(403);
    expect((await call(productsBulk.POST, { method: "POST", url: "/api/products/bulk", cookie: viewer, body: { action: "delete", ids: [id] } })).status).toBe(403);
    expect((await call(categories.POST, { method: "POST", url: "/api/categories", cookie: viewer, body: { name: "X", slug: "xx" } })).status).toBe(403);
    expect(await getDb().product.count({ where: { id } })).toBe(1); // untouched
    expect((await getDb().product.findUniqueOrThrow({ where: { id } })).name).toBe("Test Copper Wire");
  });

  it("authorization runs before validation: a forbidden user gets 403, never field errors", async () => {
    for (const r of [
      await call(products.POST, { method: "POST", url: "/api/products", cookie: viewer, body: {} }),
      await call(categories.POST, { method: "POST", url: "/api/categories", cookie: viewer, body: { name: "x" } }),
      await call(productsBulk.POST, { method: "POST", url: "/api/products/bulk", cookie: viewer, body: { nonsense: true } }),
      await call(categoriesBulk.POST, { method: "POST", url: "/api/categories/bulk", cookie: noAccess, body: "garbage" }),
    ]) {
      expect(r.status).toBe(403);
      expect(r.data.error.fields).toBeUndefined();
    }
  });

  it("a role with no products access cannot even list", async () => {
    expect((await call(products.GET, { url: "/api/products", cookie: noAccess })).status).toBe(403);
    expect((await call(categories.GET, { url: "/api/categories", cookie: noAccess })).status).toBe(403);
  });

  it("publishing needs the separate publish permission", async () => {
    const cat = await makeCategory();
    const created = await call(products.POST, { method: "POST", url: "/api/products", cookie: editor, body: productBody(cat.id) });
    expect(created.status).toBe(201); // draft is allowed
    const id = created.data.id as string;
    const pub = await call(productById.PATCH, { method: "PATCH", url: `/api/products/${id}`, params: { id }, cookie: editor, body: { status: "published" } });
    expect(pub.status).toBe(403);
    const direct = await call(products.POST, { method: "POST", url: "/api/products", cookie: editor, body: productBody(cat.id, { code: "HMV-TST-0003", slug: "pub-3", status: "published" }) });
    expect(direct.status).toBe(403);
    const bulk = await call(productsBulk.POST, { method: "POST", url: "/api/products/bulk", cookie: editor, body: { action: "status", ids: [id], status: "published" } });
    expect(bulk.status).toBe(403);
    expect((await getDb().product.findUniqueOrThrow({ where: { id } })).status).toBe("draft");
    expect((await call(productById.PATCH, { method: "PATCH", url: `/api/products/${id}`, params: { id }, cookie: admin, body: { status: "published" } })).status).toBe(200);
  });

  it("an editor without delete cannot delete", async () => {
    const cat = await makeCategory();
    const p = await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, body: productBody(cat.id) });
    const id = p.data.id as string;
    expect((await call(productById.DELETE, { method: "DELETE", url: `/api/products/${id}`, params: { id }, cookie: editor })).status).toBe(403);
    expect((await call(categoryById.DELETE, { method: "DELETE", url: `/api/categories/${cat.id}`, params: { id: cat.id }, cookie: editor })).status).toBe(403);
  });
});

describe("products", () => {
  it("creates a product: upper-cases the code, stores specs, writes an audit row", async () => {
    const cat = await makeCategory();
    const r = await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, body: productBody(cat.id) });
    expect(r.status).toBe(201);
    expect(r.data.code).toBe("HMV-TST-0001");
    expect(r.data.specifications).toEqual([expect.objectContaining({ label: "Purity", value: "99.9", unit: "%" })]);
    expect(r.data.images).toEqual([]);
    expect(r.data.publishedAt).toBeNull();
    const log = await getDb().activityLog.findFirst({ where: { entityType: "Product", entityId: r.data.id, action: "created" } });
    expect(log?.actorName).toBe("admin");
  });

  it("validates input and reports per-field errors", async () => {
    const r = await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, body: { name: "x", code: "a b", slug: "Bad Slug", categoryId: "nope", shortDescription: "short", description: "short" } });
    expect(r.status).toBe(422);
    expect(Object.keys(r.data.error.fields)).toEqual(expect.arrayContaining(["name", "code", "slug", "categoryId", "shortDescription", "description"]));
    expect((await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, body: "{not json" })).status).toBe(422);
  });

  it("rejects duplicate code (case-insensitively), duplicate slug and unknown category", async () => {
    const cat = await makeCategory();
    await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, body: productBody(cat.id) });
    const dupCode = await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, body: productBody(cat.id, { code: "HMV-tst-0001", slug: "other" }) });
    expect(dupCode.status).toBe(409);
    expect(dupCode.data.error.fields.code).toBeTruthy();
    const dupSlug = await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, body: productBody(cat.id, { code: "HMV-NEW-1" }) });
    expect(dupSlug.status).toBe(409);
    expect(dupSlug.data.error.fields.slug).toBeTruthy();
    const noCat = await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, body: productBody("0194b0e0-0000-7000-8000-000000000000", { code: "HMV-NEW-2", slug: "n2" }) });
    expect(noCat.status).toBe(422);
  });

  it("refuses client-supplied image URLs and documents: files are attachable only by the id of an uploaded file", async () => {
    const cat = await makeCategory();
    const r = await call(products.POST, {
      method: "POST", url: "/api/products", cookie: admin,
      body: productBody(cat.id, { images: [{ id: "x", url: "https://evil.example/x.png", alt: "x", isPrimary: true }], documents: [{ id: "d", name: "x.pdf", type: "other", sizeBytes: 1 }] }),
    });
    expect(r.status).toBe(422);
    expect(await getDb().productImage.count()).toBe(0);
    expect(await getDb().product.count()).toBe(0);
  });

  it("updates: replaces specs, rejects duplicate labels, sets publishedAt once, audits status changes", async () => {
    const cat = await makeCategory();
    const created = await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, body: productBody(cat.id) });
    const id = created.data.id as string;
    const dup = await call(productById.PATCH, { method: "PATCH", url: `/api/products/${id}`, params: { id }, cookie: admin, body: { specifications: [{ label: "Purity", value: "1" }, { label: "purity", value: "2" }] } });
    expect(dup.status).toBe(422);
    const upd = await call(productById.PATCH, { method: "PATCH", url: `/api/products/${id}`, params: { id }, cookie: admin, body: { specifications: [{ label: "Density", value: "8.9", unit: "g/cm3" }], status: "published" } });
    expect(upd.status).toBe(200);
    expect(upd.data.specifications.map((s: { label: string }) => s.label)).toEqual(["Density"]);
    expect(upd.data.status).toBe("published");
    const firstPublished = upd.data.publishedAt;
    expect(firstPublished).toBeTruthy();
    await call(productById.PATCH, { method: "PATCH", url: `/api/products/${id}`, params: { id }, cookie: admin, body: { status: "draft" } });
    const again = await call(productById.PATCH, { method: "PATCH", url: `/api/products/${id}`, params: { id }, cookie: admin, body: { status: "published" } });
    expect(again.data.publishedAt).toBe(firstPublished); // original publish date preserved
    expect(await getDb().activityLog.count({ where: { entityId: id, action: "status_changed" } })).toBe(3);
  });

  it("lists with search, filters, sorting and pagination", async () => {
    const cat = await makeCategory();
    const other = await makeCategory(admin, { name: "Energy", slug: "energy" });
    for (let i = 1; i <= 12; i++) {
      await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, body: productBody(i <= 8 ? cat.id : other.id, { name: `Item ${String(i).padStart(2, "0")}`, code: `HMV-LST-${i}`, slug: `item-${i}`, featured: i % 4 === 0, status: i % 3 === 0 ? "published" : "draft" }) });
    }
    const page1 = await call(products.GET, { url: "/api/products?pageSize=5&sortBy=name&sortDir=asc", cookie: viewer });
    expect(page1.data.total).toBe(12);
    expect(page1.data.pageCount).toBe(3);
    expect(page1.data.items.map((p: { name: string }) => p.name)).toEqual(["Item 01", "Item 02", "Item 03", "Item 04", "Item 05"]);
    expect((await call(products.GET, { url: `/api/products?categoryId=${other.id}`, cookie: viewer })).data.total).toBe(4);
    expect((await call(products.GET, { url: "/api/products?status=published", cookie: viewer })).data.total).toBe(4);
    expect((await call(products.GET, { url: "/api/products?featured=true", cookie: viewer })).data.total).toBe(3);
    expect((await call(products.GET, { url: "/api/products?search=lst-7", cookie: viewer })).data.total).toBe(1);
    expect((await call(products.GET, { url: "/api/products?pageSize=1000", cookie: viewer })).status).toBe(422); // page size is capped
    expect((await call(products.GET, { url: "/api/products?sortBy=passwordHash", cookie: viewer })).status).toBe(422); // sort columns are allow-listed
  });

  it("treats malformed ids as not found and unknown ids as 404", async () => {
    expect((await call(productById.GET, { url: "/api/products/not-a-uuid", params: { id: "not-a-uuid" }, cookie: admin })).status).toBe(404);
    const missing = "0194b0e0-0000-7000-8000-000000000000";
    expect((await call(productById.GET, { url: `/api/products/${missing}`, params: { id: missing }, cookie: admin })).status).toBe(404);
    expect((await call(productById.DELETE, { method: "DELETE", url: `/api/products/${missing}`, params: { id: missing }, cookie: admin })).status).toBe(404);
  });

  it("bulk status and bulk delete work and are audited", async () => {
    const cat = await makeCategory();
    const ids: string[] = [];
    for (let i = 1; i <= 3; i++) ids.push((await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, body: productBody(cat.id, { code: `HMV-BLK-${i}`, slug: `blk-${i}` }) })).data.id);
    const st = await call(productsBulk.POST, { method: "POST", url: "/api/products/bulk", cookie: admin, body: { action: "status", ids, status: "published" } });
    expect(st.data.count).toBe(3);
    expect(await getDb().product.count({ where: { status: "published", publishedAt: { not: null } } })).toBe(3);
    const del = await call(productsBulk.POST, { method: "POST", url: "/api/products/bulk", cookie: admin, body: { action: "delete", ids: ids.slice(0, 2) } });
    expect(del.data.count).toBe(2);
    expect(await getDb().product.count()).toBe(1);
    expect((await call(productsBulk.POST, { method: "POST", url: "/api/products/bulk", cookie: admin, body: { action: "delete", ids: [] } })).status).toBe(422);
  });

  it("deletes a product and cascades its specifications", async () => {
    const cat = await makeCategory();
    const p = await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, body: productBody(cat.id) });
    const id = p.data.id as string;
    expect((await call(productById.DELETE, { method: "DELETE", url: `/api/products/${id}`, params: { id }, cookie: admin })).status).toBe(200);
    expect(await getDb().productSpecification.count({ where: { productId: id } })).toBe(0);
    expect(await getDb().activityLog.count({ where: { entityId: id, action: "deleted" } })).toBe(1);
  });
});

describe("categories", () => {
  it("creates, updates and validates slugs", async () => {
    const a = await makeCategory();
    const dup = await call(categories.POST, { method: "POST", url: "/api/categories", cookie: admin, body: { name: "Other", slug: "metals" } });
    expect(dup.status).toBe(409);
    expect(dup.data.error.fields.slug).toBeTruthy();
    const upd = await call(categoryById.PATCH, { method: "PATCH", url: `/api/categories/${a.id}`, params: { id: a.id }, cookie: admin, body: { name: "Metals & Alloys", sortOrder: 3 } });
    expect(upd.data).toEqual(expect.objectContaining({ name: "Metals & Alloys", sortOrder: 3 }));
  });

  it("rejects parent cycles, including self-parenting", async () => {
    const a = await makeCategory(admin, { name: "Cat A", slug: "cat-a" });
    const b = await makeCategory(admin, { name: "Cat B", slug: "cat-b", parentId: a.id });
    const c = await makeCategory(admin, { name: "Cat C", slug: "cat-c", parentId: b.id });
    const self = await call(categoryById.PATCH, { method: "PATCH", url: `/api/categories/${a.id}`, params: { id: a.id }, cookie: admin, body: { parentId: a.id } });
    expect(self.status).toBe(422);
    const loop = await call(categoryById.PATCH, { method: "PATCH", url: `/api/categories/${a.id}`, params: { id: a.id }, cookie: admin, body: { parentId: c.id } });
    expect(loop.status).toBe(422);
    expect((await getDb().category.findUniqueOrThrow({ where: { id: a.id } })).parentId).toBeNull();
  });

  it("refuses to delete a category that has products or children", async () => {
    const parent = await makeCategory(admin, { name: "Cat P", slug: "cat-p" });
    const child = await makeCategory(admin, { name: "Cat Child", slug: "cat-ch", parentId: parent.id });
    expect((await call(categoryById.DELETE, { method: "DELETE", url: `/api/categories/${parent.id}`, params: { id: parent.id }, cookie: admin })).status).toBe(409);
    await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, body: productBody(child.id) });
    const inUse = await call(categoryById.DELETE, { method: "DELETE", url: `/api/categories/${child.id}`, params: { id: child.id }, cookie: admin });
    expect(inUse.status).toBe(409);
    expect(inUse.data.error.message).toMatch(/product/);
    expect(await getDb().category.count()).toBe(2);
    await getDb().product.deleteMany();
    expect((await call(categoryById.DELETE, { method: "DELETE", url: `/api/categories/${child.id}`, params: { id: child.id }, cookie: admin })).status).toBe(200);
  });

  it("bulk delete is blocked if any selected category is in use", async () => {
    const used = await makeCategory(admin, { name: "Cat U", slug: "cat-u" });
    const free = await makeCategory(admin, { name: "Cat F", slug: "cat-f" });
    await call(products.POST, { method: "POST", url: "/api/products", cookie: admin, body: productBody(used.id) });
    const r = await call(categoriesBulk.POST, { method: "POST", url: "/api/categories/bulk", cookie: admin, body: { action: "delete", ids: [free.id, used.id] } });
    expect(r.status).toBe(409);
    expect(await getDb().category.count()).toBe(2); // nothing was deleted (all-or-nothing)
  });
});

describe("database constraints (defence in depth)", () => {
  it("enforces normalisation and ranges even if the application is bypassed", async () => {
    const db = getDb();
    await expect(db.adminUser.create({ data: { email: "Mixed@Case.dev", name: "x", employeeId: "EMP-9999" } })).rejects.toThrow();
    const cat = await db.category.create({ data: { name: "K", slug: "k" } });
    await expect(db.product.create({ data: { code: "lower", slug: "lo", name: "n", categoryId: cat.id, shortDescription: "s", description: "d" } })).rejects.toThrow();
    await expect(db.category.update({ where: { id: cat.id }, data: { parentId: cat.id } })).rejects.toThrow();
    await expect(db.category.delete({ where: { id: cat.id } }).then(() => db.product.create({ data: { code: "OK-1", slug: "ok-1", name: "n", categoryId: cat.id, shortDescription: "s", description: "d" } }))).rejects.toThrow();
  });

  it("allows only one primary image per product", async () => {
    const db = getDb();
    const cat = await db.category.create({ data: { name: "I", slug: "i" } });
    const product = await db.product.create({ data: { code: "IMG-1", slug: "img-1", name: "n", categoryId: cat.id, shortDescription: "s", description: "d" } });
    const mk = (n: number) => db.storedFile.create({ data: { storageKey: `k/${product.id}/${n}`, originalName: `${n}.png`, mimeType: "image/png", sizeBytes: BigInt(10), kind: "image", visibility: "public", scanStatus: "clean" } });
    const [f1, f2] = [await mk(1), await mk(2)];
    await db.productImage.create({ data: { productId: product.id, fileId: f1.id, isPrimary: true } });
    await expect(db.productImage.create({ data: { productId: product.id, fileId: f2.id, isPrimary: true } })).rejects.toThrow();
    await db.productImage.create({ data: { productId: product.id, fileId: f2.id, isPrimary: false } });
  });
});
