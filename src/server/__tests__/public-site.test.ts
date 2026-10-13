import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import S3rver from "s3rver";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb } from "@/server/db";
import { getStorage, setStorageForTests } from "@/server/storage";
import { call, ensurePermissions, loginCookie, makeRole, makeUser } from "./helpers";
import * as settingsRoute from "@/app/api/settings/[section]/route";
import * as enquiries from "@/app/api/public/enquiries/route";
import * as rfqs from "@/app/api/public/rfqs/route";
import * as applications from "@/app/api/public/applications/route";
import { clearSiteSettingsCache, getSiteSettings, getCareer, getPost, getProduct, getProject, getPublicSettings, listCareers, listCategories, listLocations, listOpportunities, listPosts, listPrices, listProducts, listProjects, listSitemapEntries } from "@/server/services/public";

/**
 * The public website: what it may read from the CMS (published and safe fields only) and the three public forms
 * (contact enquiry, RFQ, job application), which anyone on the internet can call.
 */
type H = Parameters<typeof call>[0];
const db = () => getDb();
const post = (handler: unknown, body: unknown, extra: Record<string, unknown> = {}) => call(handler as H, { method: "POST", url: "/api/public/x", body, ...extra });
const day = (offset: number) => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + offset)); };

const enquiry = (over: Record<string, unknown> = {}) => ({ name: "Asha Rao", email: "asha@buyer.test", phone: "+91 98765 43210", company: "Rao Steels", subject: "Iron ore enquiry", message: "We would like a quotation for iron ore fines, 5,000 MT per month.", consent: true, ...over });
const rfq = (over: Record<string, unknown> = {}) => ({ companyName: "Nordic Alloys", contactName: "Lars", email: "lars@nordic.test", phone: "+47 22 00 00 00", country: "Norway", requirement: "Manganese ore", quantity: 2500, quantityUnit: "MT", incoterm: "CIF", deliveryPort: "Rotterdam", message: "Spot requirement.", consent: true, ...over });

beforeEach(async () => {
  await db().rateLimit.deleteMany();
  await db().contactEnquiry.deleteMany();
  await db().rfq.deleteMany();
});

/* ═══════════════════════ public forms ═══════════════════════ */
describe("contact enquiry form", () => {
  it("stores a valid enquiry with consent recorded and answers without internal details", async () => {
    const r = await post(enquiries.POST, enquiry());
    expect(r.status).toBe(201);
    expect(r.data).toEqual({ ok: true });
    const row = await db().contactEnquiry.findFirstOrThrow();
    expect(row).toMatchObject({ name: "Asha Rao", email: "asha@buyer.test", subject: "Iron ore enquiry", status: "new", source: "contact_page" });
    expect(row.consentAt).toBeTruthy();
    expect(row.assignedToId).toBeNull();
  });

  it("normalises the email and trims every field", async () => {
    await post(enquiries.POST, enquiry({ email: "  Asha@Buyer.TEST ", name: "  Asha Rao  " }));
    expect(await db().contactEnquiry.findFirstOrThrow()).toMatchObject({ email: "asha@buyer.test", name: "Asha Rao" });
  });

  it("refuses invalid input with field errors and stores nothing", async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ email: "not-an-email" }, "email"], [{ name: "A" }, "name"], [{ subject: "" }, "subject"], [{ message: "short" }, "message"],
      [{ consent: false }, "consent"], [{ consent: undefined }, "consent"], [{ phone: "call me maybe" }, "phone"], [{ message: "x".repeat(4001) }, "message"],
      [{ source: "somewhere_else" }, "source"],
    ];
    for (const [over, field] of cases) {
      const r = await post(enquiries.POST, enquiry(over));
      expect(r.status, JSON.stringify(over)).toBe(422);
      expect(r.data.error.fields, JSON.stringify(over)).toHaveProperty(field);
    }
    expect(await db().contactEnquiry.count()).toBe(0);
  });

  it("silently drops bots that fill the hidden field (looks like success, stores nothing)", async () => {
    const r = await post(enquiries.POST, enquiry({ website: "https://spam.example" }));
    expect(r.status).toBe(201);
    expect(r.data).toEqual({ ok: true });
    expect(await db().contactEnquiry.count()).toBe(0);
  });

  it("rejects link-stuffed messages", async () => {
    const spam = "buy now http://a.test http://b.test http://c.test http://d.test";
    const r = await post(enquiries.POST, enquiry({ message: spam }));
    expect(r.status).toBe(422);
    expect(r.data.error.fields).toHaveProperty("message");
    expect((await post(enquiries.POST, enquiry({ message: "See http://a.test and http://b.test for the datasheet." }))).status).toBe(201);
  });

  it("is rate limited per email address and the answer reveals nothing", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await post(enquiries.POST, enquiry())).status);
    expect(statuses.slice(0, 6).every((s) => s === 201)).toBe(true);
    expect(statuses.slice(6)).toEqual([429, 429]);
    const other = await post(enquiries.POST, enquiry({ email: "someone.else@buyer.test" }));
    expect(other.status).toBe(201); // another address is unaffected
    const blocked = await post(enquiries.POST, enquiry());
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(JSON.stringify(blocked.data)).not.toMatch(/asha|buyer\.test|@/i);
  });

  it("only accepts requests that come from this site, and refuses oversized bodies", async () => {
    expect((await post(enquiries.POST, enquiry(), { origin: "https://evil.example" })).status).toBe(403);
    expect((await post(enquiries.POST, enquiry(), { origin: null })).status).toBe(403);
    const huge = await post(enquiries.POST, enquiry(), { headers: { "content-length": String(200 * 1024) } });
    expect(huge.status).toBe(413);
    expect(await db().contactEnquiry.count()).toBe(0);
  });

  it("stores markup as plain text (it is only ever shown escaped)", async () => {
    await post(enquiries.POST, enquiry({ message: "<script>alert(1)</script> hello there, interested in granite" }));
    expect((await db().contactEnquiry.findFirstOrThrow()).message).toContain("<script>alert(1)</script>");
  });
});

describe("request for quotation (RFQ) form", () => {
  it("stores a valid RFQ and returns a reference number", async () => {
    const r = await post(rfqs.POST, rfq());
    expect(r.status).toBe(201);
    expect(r.data.reference).toMatch(/^RFQ-\d{4}-[A-HJ-NP-Z2-9]{6}$/);
    const row = await db().rfq.findFirstOrThrow();
    expect(row).toMatchObject({ reference: r.data.reference, companyName: "Nordic Alloys", incoterm: "CIF", quantityUnit: "MT", status: "new" });
    expect(Number(row.quantity)).toBe(2500);
    expect(row.consentAt).toBeTruthy();
  });

  it("gives every RFQ its own reference", async () => {
    const refs = new Set<string>();
    for (let i = 0; i < 5; i++) refs.add((await post(rfqs.POST, rfq({ email: `buyer${i}@x.test` }))).data.reference);
    expect(refs.size).toBe(5);
  });

  it("validates quantity, unit, incoterm, phone and consent", async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ quantity: 0 }, "quantity"], [{ quantity: -5 }, "quantity"], [{ quantity: "lots" }, "quantity"], [{ quantity: 1e12 }, "quantity"],
      [{ quantityUnit: "tons-ish" }, "quantityUnit"], [{ incoterm: "ANY" }, "incoterm"], [{ phone: "123" }, "phone"], [{ consent: false }, "consent"],
      [{ companyName: "" }, "companyName"], [{ deliveryPort: "" }, "deliveryPort"], [{ email: "x" }, "email"],
    ];
    for (const [over, field] of cases) {
      const r = await post(rfqs.POST, rfq(over));
      expect(r.status, JSON.stringify(over)).toBe(422);
      expect(r.data.error.fields, JSON.stringify(over)).toHaveProperty(field);
    }
    expect(await db().rfq.count()).toBe(0);
  });

  it("drops bots silently and rate limits per email", async () => {
    expect((await post(rfqs.POST, rfq({ website: "x" }))).status).toBe(201);
    expect(await db().rfq.count()).toBe(0);
    let blocked = 0;
    for (let i = 0; i < 8; i++) if ((await post(rfqs.POST, rfq())).status === 429) blocked++;
    expect(blocked).toBeGreaterThanOrEqual(2);
  });
});

describe("job application form", () => {
  let dir = "";
  let s3: S3rver;
  const PORT = 5600 + Math.floor(Math.random() * 300);
  const ENV = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_ENDPOINT", "S3_REGION", "S3_FORCE_PATH_STYLE"] as const;
  const saved: Record<string, string | undefined> = {};
  let careerId = "";

  beforeAll(async () => {
    for (const k of ENV) saved[k] = process.env[k];
    dir = mkdtempSync(join(tmpdir(), "hv-pub-s3-"));
    s3 = new S3rver({ port: PORT, address: "127.0.0.1", silent: true, directory: dir, configureBuckets: [{ name: "hv-public", configs: [] }] });
    await s3.run();
  });
  afterAll(async () => {
    await s3.close();
    rmSync(dir, { recursive: true, force: true });
    setStorageForTests(undefined);
    for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    await db().jobApplication.deleteMany();
    await db().career.deleteMany({ where: { slug: { startsWith: "pub-" } } });
    await db().storedFile.deleteMany({ where: { kind: "resume" } });
  });
  const withStorage = () => { Object.assign(process.env, { S3_BUCKET: "hv-public", S3_ACCESS_KEY_ID: "S3RVER", S3_SECRET_ACCESS_KEY: "S3RVER", S3_ENDPOINT: `http://127.0.0.1:${PORT}`, S3_REGION: "us-east-1" }); setStorageForTests(undefined); expect(getStorage()).toBeTruthy(); };
  const noStorage = () => { for (const k of ENV) delete process.env[k]; setStorageForTests(undefined); };

  const career = (over: Record<string, unknown> = {}) => db().career.create({ data: { slug: `pub-${Math.random().toString(36).slice(2, 8)}`, title: "Logistics Coordinator", department: "Operations", location: "Mumbai", employmentType: "full_time", experience: "3+ years", descriptionHtml: "<p>Coordinate shipments.</p>", requirementsHtml: "<ul><li>Port experience</li></ul>", deadline: day(30), status: "open", ...over } });
  const apply = (slug: string, over: Record<string, string> = {}, file?: File) => {
    const fd = new FormData();
    const base: Record<string, string> = { careerSlug: slug, applicantName: "Ravi Kumar", email: "ravi@candidate.test", phone: "+91 90000 11111", currentCompany: "Port Co", experienceYears: "4", coverNote: "Keen to join.", consent: "true", ...over };
    for (const [k, v] of Object.entries(base)) if (v !== undefined) fd.set(k, v);
    if (file) fd.set("resume", file);
    return call(applications.POST as H, { method: "POST", url: "/api/public/applications", body: "multipart", form: fd });
  };
  const pdf = () => new File([new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"))], "cv.pdf", { type: "application/pdf" });

  beforeEach(async () => { await db().jobApplication.deleteMany(); await db().storedFile.deleteMany({ where: { kind: "resume" } }); careerId = (await career()).slug; });

  it("accepts an application without a resume", async () => {
    noStorage();
    const r = await apply(careerId);
    expect(r.status).toBe(201);
    expect(r.data).toEqual({ ok: true });
    const row = await db().jobApplication.findFirstOrThrow();
    expect(row).toMatchObject({ applicantName: "Ravi Kumar", email: "ravi@candidate.test", experienceYears: 4, status: "new", resumeFileId: null });
    expect(row.consentAt).toBeTruthy();
  });

  it("stores a valid resume privately and links it to the application", async () => {
    withStorage();
    const r = await apply(careerId, {}, pdf());
    expect(r.status, JSON.stringify(r.data)).toBe(201);
    const row = await db().jobApplication.findFirstOrThrow({ include: { resumeFile: true } });
    expect(row.resumeFile).toMatchObject({ kind: "resume", visibility: "private", mimeType: "application/pdf" });
    expect(row.resumeFile!.storageKey).toMatch(/^documents\/\d{4}\/[0-9a-f-]{36}\.pdf$/);
    expect(JSON.stringify(r.data)).not.toMatch(/documents\/|storage|key/i);
  });

  it("refuses a resume that is not a real document, or too large, and stores nothing", async () => {
    withStorage();
    const html = new File([new Uint8Array(Buffer.from("<html><script>alert(1)</script></html>"))], "cv.pdf", { type: "application/pdf" });
    expect((await apply(careerId, {}, html)).status).toBe(415);
    const big = new File([new Uint8Array(Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(5 * 1024 * 1024 + 10)]))], "big.pdf", { type: "application/pdf" });
    expect([413]).toContain((await apply(careerId, { email: "big@candidate.test" }, big)).status);
    expect(await db().jobApplication.count()).toBe(0);
    expect(await db().storedFile.count({ where: { kind: "resume" } })).toBe(0);
  });

  it("says plainly when resume upload is unavailable, instead of pretending", async () => {
    noStorage();
    const r = await apply(careerId, { email: "nofile@candidate.test" }, pdf());
    expect(r.status).toBe(503);
    expect(r.data.error.code).toBe("resume_unavailable");
    expect(await db().jobApplication.count()).toBe(0);
  });

  it("only accepts applications for positions that are open and not past their deadline", async () => {
    noStorage();
    expect((await apply("does-not-exist")).status).toBe(404);
    const closed = await career({ status: "closed" });
    const expired = await career({ deadline: day(-1) });
    const draft = await career({ status: "draft" });
    for (const c of [closed, expired, draft]) expect((await apply(c.slug, { email: `x${Math.random()}@c.test` })).status, c.slug).toBe(404);
    expect(await db().jobApplication.count()).toBe(0);
  });

  it("refuses the same person applying twice for the same position", async () => {
    noStorage();
    expect((await apply(careerId)).status).toBe(201);
    const again = await apply(careerId);
    expect(again.status).toBe(409);
    expect(again.data.error.code).toBe("already_applied");
    expect(await db().jobApplication.count()).toBe(1);
  });

  it("validates every field and requires consent", async () => {
    noStorage();
    const bad: [Record<string, string>, string][] = [
      [{ applicantName: "A" }, "applicantName"], [{ email: "nope" }, "email"], [{ phone: "12" }, "phone"], [{ experienceYears: "-1" }, "experienceYears"],
      [{ experienceYears: "1.5" }, "experienceYears"], [{ experienceYears: "100" }, "experienceYears"], [{ consent: "false" }, "consent"], [{ careerSlug: "Not A Slug!" }, "careerSlug"],
    ];
    for (const [over, field] of bad) {
      const r = await apply(careerId, over);
      expect(r.status, JSON.stringify(over)).toBe(422);
      expect(r.data.error.fields, JSON.stringify(over)).toHaveProperty(field);
    }
    expect(await db().jobApplication.count()).toBe(0);
  });

  it("drops bots silently and enforces the same-origin rule", async () => {
    noStorage();
    expect((await apply(careerId, { website: "spam" })).status).toBe(201);
    expect(await db().jobApplication.count()).toBe(0);
    const fd = new FormData();
    fd.set("careerSlug", careerId);
    expect((await call(applications.POST as H, { method: "POST", url: "/api/public/applications", body: "multipart", form: fd, origin: "https://evil.example" })).status).toBe(403);
  });
});

/* ═══════════════════════ public data readers ═══════════════════════ */
describe("what the public website may read", () => {
  beforeEach(async () => {
    const d = db();
    await d.post.deleteMany(); await d.project.deleteMany(); await d.product.deleteMany(); await d.category.deleteMany(); await d.location.deleteMany();
    await d.commodityPrice.deleteMany(); await d.tradeOpportunity.deleteMany(); await d.commodity.deleteMany(); await d.siteSetting.deleteMany();
  });

  const mkPost = (over: Record<string, unknown> = {}) => db().post.create({ data: { slug: `p-${Math.random().toString(36).slice(2, 8)}`, title: "Iron ore outlook", excerpt: "Where demand is heading.", contentHtml: "<p>Body</p>", category: "market_insight", authorName: "Editorial Desk", status: "published", publishedAt: new Date(), ...over } });

  it("posts: only published ones, newest first, with scripts and handlers removed from the body", async () => {
    await mkPost({ slug: "old", title: "Old", publishedAt: new Date(Date.now() - 86400000 * 5) });
    await mkPost({ slug: "new", title: "New" });
    await mkPost({ slug: "draft", status: "draft" });
    await mkPost({ slug: "archived", status: "archived" });
    await mkPost({ slug: "evil", title: "Evil", contentHtml: '<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">click</a><img src=x onerror=alert(1)>' });
    const list = await listPosts();
    expect(list.items.map((p) => p.slug)).toEqual(expect.arrayContaining(["new", "old", "evil"]));
    expect(list.items.map((p) => p.slug)).not.toContain("draft");
    expect(list.items.map((p) => p.slug)).not.toContain("archived");
    expect(list.total).toBe(3);
    expect(await getPost("draft")).toBeNull();
    const evil = (await getPost("evil"))!;
    expect(evil.html).not.toMatch(/script|onclick|onerror|javascript:|<img/i);
    expect(Object.keys(evil).sort()).toEqual(["author", "category", "categoryKey", "date", "excerpt", "html", "metaDescription", "metaTitle", "slug", "tags", "title"]);
    expect((await listPosts({ category: "company_news" })).items).toHaveLength(0);
  });

  it("projects: only published", async () => {
    const base = { title: "Shipment", summary: "s", contentHtml: "<p>x</p>", client: "C", commodityName: "Iron ore", region: "Asia", startDate: day(-30) };
    await db().project.create({ data: { ...base, slug: "ok", status: "published" } });
    await db().project.create({ data: { ...base, slug: "hidden", status: "draft" } });
    expect((await listProjects()).map((p) => p.slug)).toEqual(["ok"]);
    expect(await getProject("hidden")).toBeNull();
    expect((await getProject("ok"))!.html).toBe("<p>x</p>");
  });

  it("products: published products in published categories only, and no internal fields", async () => {
    const live = await db().category.create({ data: { name: "Ores", slug: "ores", status: "published" } });
    const hiddenCat = await db().category.create({ data: { name: "Secret", slug: "secret", status: "draft" } });
    const base = { shortDescription: "s", description: "d", applications: ["Steel"], availability: "available" as const };
    await db().product.create({ data: { ...base, code: "P1", slug: "iron", name: "Iron Ore", categoryId: live.id, status: "published", specifications: { create: [{ label: "Fe", value: "62", unit: "%", sortOrder: 1 }] } } });
    await db().product.create({ data: { ...base, code: "P2", slug: "draft-prod", name: "Draft", categoryId: live.id, status: "draft" } });
    await db().product.create({ data: { ...base, code: "P3", slug: "in-hidden-cat", name: "Hidden", categoryId: hiddenCat.id, status: "published" } });
    const list = await listProducts();
    expect(list.items.map((p) => p.slug)).toEqual(["iron"]);
    expect(await getProduct("draft-prod")).toBeNull();
    expect(await getProduct("in-hidden-cat")).toBeNull();
    const p = (await getProduct("iron"))!;
    expect(p.specifications).toEqual([{ label: "Fe", value: "62", unit: "%" }]);
    expect(JSON.stringify(p)).not.toMatch(/"id"|createdAt|categoryId|status/);
    expect((await listCategories()).map((c) => [c.slug, c.count])).toEqual([["ores", 1]]);
    expect((await listProducts({ search: "iron" })).total).toBe(1);
    expect((await listProducts({ search: "zzz" })).total).toBe(0);
  });

  it("careers: only open, not past their deadline", async () => {
    const base = { title: "Role", department: "Ops", location: "Mumbai", employmentType: "full_time" as const, experience: "2y", descriptionHtml: "<p>d</p>", requirementsHtml: "<p>r</p>" };
    await db().career.create({ data: { ...base, slug: "pub-open", deadline: day(10), status: "open" } });
    await db().career.create({ data: { ...base, slug: "pub-today", deadline: day(0), status: "open" } });
    await db().career.create({ data: { ...base, slug: "pub-past", deadline: day(-1), status: "open" } });
    await db().career.create({ data: { ...base, slug: "pub-closed", deadline: day(10), status: "closed" } });
    await db().career.create({ data: { ...base, slug: "pub-draft", deadline: day(10), status: "draft" } });
    expect((await listCareers()).map((c) => c.slug).sort()).toEqual(["pub-open", "pub-today"]);
    expect(await getCareer("pub-past")).toBeNull();
    expect(await getCareer("pub-draft")).toBeNull();
    await db().career.deleteMany({ where: { slug: { startsWith: "pub-" } } });
  });

  it("locations: only active ones, and no contact details", async () => {
    const base = { type: "mine" as const, country: "IN", city: "Goa", address: "Secret street 1", phone: "+91 1", email: "private@x.test" };
    await db().location.create({ data: { ...base, name: "Visible mine", active: true } });
    await db().location.create({ data: { ...base, name: "Hidden mine", active: false } });
    const list = await listLocations();
    expect(list.map((l) => l.name)).toEqual(["Visible mine"]);
    expect(JSON.stringify(list)).not.toMatch(/Secret street|private@x\.test|\+91 1/);
  });

  it("commodity desk: latest PUBLISHED price of PUBLISHED commodities; open, unexpired opportunities", async () => {
    const live = await db().commodity.create({ data: { name: "Iron Ore", slug: "iron-ore", code: "FE", group: "Minerals", unit: "MT", description: "d", status: "published" } });
    const draft = await db().commodity.create({ data: { name: "Draft Metal", slug: "draft-metal", code: "DM", group: "Metals", unit: "MT", description: "d", status: "draft" } });
    await db().commodityPrice.create({ data: { commodityId: live.id, price: 100, unit: "MT", market: "CFR China", effectiveDate: day(-10), status: "published" } });
    await db().commodityPrice.create({ data: { commodityId: live.id, price: 110, unit: "MT", market: "CFR China", effectiveDate: day(-2), status: "published" } });
    await db().commodityPrice.create({ data: { commodityId: live.id, price: 999, unit: "MT", market: "CFR China", effectiveDate: day(-1), status: "draft" } });
    await db().commodityPrice.create({ data: { commodityId: draft.id, price: 5, unit: "MT", market: "x", effectiveDate: day(-1), status: "published" } });
    const prices = await listPrices();
    expect(prices).toHaveLength(1);
    expect(prices[0]).toMatchObject({ name: "Iron Ore", price: 110, currency: "USD" });
    const opp = { commodityId: live.id, type: "sell" as const, quantityValue: 1000, quantityUnit: "MT", originRegion: "India", destinationRegion: "China", incoterm: "FOB", description: "d" };
    await db().tradeOpportunity.create({ data: { ...opp, title: "Live", validUntil: day(5), status: "available" } });
    await db().tradeOpportunity.create({ data: { ...opp, title: "Expired", validUntil: day(-1), status: "available" } });
    await db().tradeOpportunity.create({ data: { ...opp, title: "Draft", validUntil: day(5), status: "draft" } });
    await db().tradeOpportunity.create({ data: { ...opp, title: "Sold", validUntil: day(5), status: "sold" } });
    expect((await listOpportunities()).map((o) => o.title)).toEqual(["Live"]);
  });

  it("settings: only the whitelisted public fields, and only http(s) social links", async () => {
    await db().siteSetting.create({ data: { key: "site.contact", value: { primaryEmail: "info@hamsavahin.test", primaryPhone: "+91 11 2345 6789", address: "1 Mine Road", socials: { linkedin: "https://linkedin.com/company/x", twitter: "javascript:alert(1)", facebook: "", youtube: "ftp://y" }, internalNote: "never public" } } });
    await db().siteSetting.create({ data: { key: "site.general", value: { siteName: "Hamsavahin", tagline: "Minerals", maintenanceMode: true, timezone: "UTC" } } });
    await db().siteSetting.create({ data: { key: "site.seo", value: { googleSiteVerification: "secret-token" } } });
    const s = await getPublicSettings();
    expect(s).toMatchObject({ siteName: "Hamsavahin", email: "info@hamsavahin.test", phone: "+91 11 2345 6789", address: "1 Mine Road" });
    expect(s.socials).toEqual({ linkedin: "https://linkedin.com/company/x", twitter: "", facebook: "", youtube: "" });
    expect(JSON.stringify(s)).not.toMatch(/never public|secret-token|maintenance|timezone/);
  });

  it("settings fall back to empty values (no invented contact details) when nothing is configured", async () => {
    expect(await getPublicSettings()).toMatchObject({ email: "", phone: "", address: "", footerAbout: "", copyright: "" });
  });

  it("sitemap lists only public, published content", async () => {
    await mkPost({ slug: "in-sitemap" });
    await mkPost({ slug: "not-in-sitemap", status: "draft" });
    const paths = (await listSitemapEntries()).map((e) => e.path);
    expect(paths).toContain("/insights/in-sitemap");
    expect(paths).not.toContain("/insights/not-in-sitemap");
  });
});

describe("settings saved in the admin reach the public website", () => {
  it("the admin's contact and footer settings (stored as site.<section>) appear on the website at once, and removing them hides them again", async () => {
    await ensurePermissions();
    await db().siteSetting.deleteMany();
    const role = await makeRole("Settings Admin (public test)", { settings_contact: ["view", "manage_settings"], settings_footer: ["view", "manage_settings"] });
    const user = await makeUser("settings-pub@s.dev", role.id);
    const cookie = await loginCookie("settings-pub@s.dev");
    const put = (section: string, body: unknown) => call(settingsRoute.PUT as H, { method: "PUT", url: `/api/settings/${section}`, cookie, body, params: { section } });
    expect(await getSiteSettings()).toMatchObject({ email: "", phone: "", address: "" });
    const contact = { primaryEmail: "sales@hamsavahin.test", primaryPhone: "+91 22 5555 0000", address: "1 Harbour Road, Mumbai", socials: { linkedin: "https://linkedin.com/company/hv", twitter: "", facebook: "", youtube: "" } };
    const first = await put("contact", contact);
    expect(first.status, JSON.stringify(first.data)).toBe(200);
    expect((await put("footer", { aboutText: "About text", copyright: "© HV", showNewsletter: false, columns: [] })).status).toBe(200);
    expect(await getSiteSettings()).toMatchObject({ email: "sales@hamsavahin.test", phone: "+91 22 5555 0000", address: "1 Harbour Road, Mumbai", footerAbout: "About text", copyright: "© HV" });
    expect((await getSiteSettings()).socials.linkedin).toBe("https://linkedin.com/company/hv");
    await put("contact", { ...contact, primaryEmail: "", primaryPhone: "", address: "", socials: { linkedin: "", twitter: "", facebook: "", youtube: "" } });
    expect(await getSiteSettings()).toMatchObject({ email: "", phone: "", address: "" });
    clearSiteSettingsCache();
    await db().siteSetting.deleteMany();
    await db().adminUser.delete({ where: { id: user.id } });
    await db().role.delete({ where: { id: role.id } });
  });
});
