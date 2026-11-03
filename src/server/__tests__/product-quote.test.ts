import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db";
import { setMailer, type MailMessage } from "@/server/mail";
import { getNotificationAddress } from "@/server/config";
import { listCategories, listProducts, listRecentProducts } from "@/server/services/public";
import { call, ensurePermissions, loginCookie, makeRole, makeUser } from "./helpers";
import * as enquiries from "@/app/api/public/enquiries/route";
import * as rfqs from "@/app/api/public/rfqs/route";
import * as products from "@/app/api/products/route";
import * as productById from "@/app/api/products/[id]/route";

/**
 * Products as the website shows them, the simple product form, the quote request for one product, and the e-mails it sends:
 * the company mailbox (SMTP_USER) gets the visitor's details with the product link, and the visitor gets a thank-you.
 */
type H = Parameters<typeof call>[0];
const db = () => getDb();
const MAILBOX = "company@hamsavahin.test";
const sink: (MailMessage & { replyTo?: string })[] = [];
const saved: Record<string, string | undefined> = {};
let cookie = "";
let categoryId = "";

const post = (handler: unknown, body: unknown) => call(handler as H, { method: "POST", url: "/api/public/x", body });
const quote = (slug: string, over: Record<string, unknown> = {}) => ({ name: "Asha Rao", email: "asha@buyer.test", phone: "+91 98765 43210", subject: "ignored", message: "We need 5,000 MT per month, delivered to Mundra port.", source: "product_page", productSlug: slug, consent: true, ...over });
const create = (body: Record<string, unknown>) => call(products.POST as H, { method: "POST", url: "/api/products", cookie, body });
const patch = (id: string, body: Record<string, unknown>) => call(productById.PATCH as H, { method: "PATCH", url: `/api/products/${id}`, cookie, body, params: { id } });
const simple = (over: Record<string, unknown> = {}) => ({ name: "Iron Ore Fines", categoryId, description: "High grade iron ore fines supplied in bulk for steelmaking.", ...over });
const to = (addr: string) => sink.filter((m) => m.to === addr);

beforeAll(async () => {
  for (const k of ["SMTP_USER", "SMTP_PASSWORD", "SMTP_HOST", "MAIL_FROM"]) saved[k] = process.env[k];
  process.env.SMTP_USER = MAILBOX;
  await ensurePermissions();
  const d = db();
  await d.adminUser.deleteMany();
  await d.role.deleteMany();
  const sa = await makeRole("Super Admin", {}, true);
  await makeUser("sa@pq.dev", sa.id);
  cookie = await loginCookie("sa@pq.dev");
  await d.product.deleteMany();
  await d.category.deleteMany({ where: { slug: { startsWith: "pq-" } } });
  categoryId = (await d.category.create({ data: { name: "PQ Metals", slug: "pq-metals", description: "x", status: "published" } })).id;
});
afterAll(async () => {
  setMailer(null);
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  await db().product.deleteMany();
  await db().contactEnquiry.deleteMany();
  await db().category.deleteMany({ where: { slug: { startsWith: "pq-" } } });
});
beforeEach(async () => {
  sink.length = 0;
  setMailer({ send: async (m) => { sink.push(m); return { delivered: true, providerMessageId: "sink" }; } });
  await db().product.deleteMany();
  await db().contactEnquiry.deleteMany();
  await db().rateLimit.deleteMany();
});

describe("the simple product form", () => {
  it("needs only a name, a category and the details: code, address and summary are made, and the product is on the website", async () => {
    const r = await create(simple({ applications: ["Steel making", "Construction"], origin: "India / Brazil", specifications: [{ label: "Purity", value: "Fe 57-65%" }, { label: "MOQ", value: ">10000MT" }] }));
    expect(r.status, JSON.stringify(r.data)).toBe(201);
    expect(r.data).toMatchObject({ name: "Iron Ore Fines", slug: "iron-ore-fines", status: "published", applications: ["Steel making", "Construction"], origin: "India / Brazil" });
    expect(r.data.code).toMatch(/^P-[0-9A-F]{8}$/);
    expect(r.data.shortDescription).toBe("High grade iron ore fines supplied in bulk for steelmaking.");
    expect((await listProducts()).items.map((p) => p.slug)).toEqual(["iron-ore-fines"]);
  });

  it("gives two products with the same name different addresses and codes", async () => {
    const a = await create(simple());
    const b = await create(simple());
    expect([a.data.slug, b.data.slug]).toEqual(["iron-ore-fines", "iron-ore-fines-2"]);
    expect(a.data.code).not.toBe(b.data.code);
  });

  it("cuts a long description at a word for the short summary, and keeps it in step when the details change", async () => {
    const long = "Iron ore fines ".repeat(30).trim();
    const r = await create(simple({ description: long }));
    expect(r.data.shortDescription.length).toBeLessThanOrEqual(200);
    expect(r.data.shortDescription.endsWith("…")).toBe(true);
    const e = await patch(r.data.id, { description: "A completely different set of details for this product." });
    expect(e.data.shortDescription).toBe("A completely different set of details for this product.");
    expect(e.data.slug).toBe(r.data.slug); // the address does not change when the details do
  });

  it("starts hidden (draft) for someone who may add products but not publish them", async () => {
    const role = await makeRole("Adds only", { products: ["view", "create"], categories: ["view"] });
    await makeUser("adds@pq.dev", role.id);
    const c = await loginCookie("adds@pq.dev");
    const r = await call(products.POST as H, { method: "POST", url: "/api/products", cookie: c, body: simple() });
    expect(r.status, JSON.stringify(r.data)).toBe(201);
    expect(r.data.status).toBe("draft");
    expect((await listProducts()).items).toHaveLength(0);
  });

  it("the switch: hiding a product removes it from the website, showing it brings it back", async () => {
    const r = await create(simple());
    expect((await listProducts()).total).toBe(1);
    expect((await patch(r.data.id, { status: "draft" })).data.status).toBe("draft");
    expect((await listProducts()).total).toBe(0);
    expect((await listRecentProducts(6))).toHaveLength(0);
    expect((await patch(r.data.id, { status: "published" })).data.status).toBe("published");
    expect((await listProducts()).total).toBe(1);
  });

  it("the card gets the first four specifications, what it is used for, and the location", async () => {
    await create(simple({ applications: ["Steel making"], origin: "India", specifications: ["A", "B", "C", "D", "E"].map((l) => ({ label: l, value: `v${l}` })) }));
    const [card] = (await listProducts()).items;
    expect(card.specs.map((x) => x.label)).toEqual(["A", "B", "C", "D"]);
    expect(card).toMatchObject({ usedFor: ["Steel making"], origin: "India" });
  });

  it("the website lists only categories that have a product to show", async () => {
    await db().category.create({ data: { name: "PQ Empty", slug: "pq-empty", description: "x", status: "published" } });
    expect((await listCategories()).map((c) => c.slug)).not.toContain("pq-empty");
    await create(simple());
    expect((await listCategories()).map((c) => c.slug)).toContain("pq-metals");
  });
});

describe("Request quote on a product page", () => {
  it("e-mails the company mailbox the visitor's details and the product link, with Reply-To set to the visitor", async () => {
    await create(simple({ name: "Quartz Lumps" }));
    const r = await post(enquiries.POST, quote("quartz-lumps"));
    expect(r.status, JSON.stringify(r.data)).toBe(201);
    const [m] = to(MAILBOX);
    expect(to(MAILBOX)).toHaveLength(1);
    expect(m.subject).toContain("New quote request: Quartz Lumps");
    expect(m.replyTo).toBe("asha@buyer.test");
    for (const part of ["Asha Rao", "asha@buyer.test", "+91 98765 43210", "Quartz Lumps", "We need 5,000 MT per month", "/products/quartz-lumps"]) expect(m.text, part).toContain(part);
    expect(m.html).toContain('href="http://localhost:3000/products/quartz-lumps"');
  });

  it("thanks the visitor by e-mail for the product, and says the team will make contact", async () => {
    await create(simple({ name: "Quartz Lumps" }));
    await post(enquiries.POST, quote("quartz-lumps"));
    const [m] = to("asha@buyer.test");
    expect(m.subject).toContain("Thank you for your quote request: Quartz Lumps");
    expect(m.text).toMatch(/Thank you for filling in the form for Quartz Lumps/);
    expect(m.text).toMatch(/will contact you shortly/);
    expect(m.text).toContain("/products/quartz-lumps");
  });

  it("keeps the request in the admin enquiries with the product name and link written into the message", async () => {
    await create(simple({ name: "Quartz Lumps" }));
    await post(enquiries.POST, quote("quartz-lumps", { subject: "tampered subject" }));
    const row = await db().contactEnquiry.findFirstOrThrow();
    expect(row.subject).toBe("Quote request: Quartz Lumps"); // the product comes from the database, not from what the visitor sent
    expect(row.message).toContain("Requested product: Quartz Lumps");
    expect(row.message).toContain("Product link: http://localhost:3000/products/quartz-lumps");
    expect(row.source).toBe("product_page");
  });

  it("needs the phone number, and refuses unknown, hidden or malformed products", async () => {
    const hidden = await create(simple({ name: "Hidden Ore" }));
    await patch(hidden.data.id, { status: "draft" });
    await create(simple({ name: "Shown Ore" }));
    const noPhone = await post(enquiries.POST, quote("shown-ore", { phone: "" }));
    expect(noPhone.status).toBe(422);
    expect(noPhone.data.error.fields).toHaveProperty("phone");
    expect((await post(enquiries.POST, quote("does-not-exist"))).status).toBe(404);
    expect((await post(enquiries.POST, quote("hidden-ore"))).status).toBe(404);
    expect((await post(enquiries.POST, quote("Not A Slug!"))).status).toBe(422);
    expect(sink).toHaveLength(0);
    expect(await db().contactEnquiry.count()).toBe(0);
  });

  it("escapes what the visitor typed, and keeps line breaks out of the subject", async () => {
    await create(simple({ name: "Shown Ore" }));
    await post(enquiries.POST, quote("shown-ore", { name: "Eve", message: "<script>alert(1)</script> <img src=x onerror=alert(1)> need ore please" }));
    const [m] = to(MAILBOX);
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;img src=x");
    expect(m.subject).not.toMatch(/[\r\n]/);
  });

  it("takes only letters in a name and only digits in a phone number", async () => {
    await create(simple({ name: "Shown Ore" }));
    expect((await post(enquiries.POST, quote("shown-ore", { name: "Eve 123" }))).status).toBe(422);
    expect((await post(enquiries.POST, quote("shown-ore", { name: "Eve <b>" }))).status).toBe(422);
    expect((await post(enquiries.POST, quote("shown-ore", { phone: "call me" }))).status).toBe(422);
    expect((await post(enquiries.POST, quote("shown-ore", { phone: "98765-43210" }))).status).toBe(422);
    expect((await post(enquiries.POST, quote("shown-ore", { name: "Anne-Marie O'Neil", phone: "+91 98765 43210" }))).status).toBe(201);
  });

  it("never fails the form when the mail server is down; the request is still saved", async () => {
    await create(simple({ name: "Shown Ore" }));
    setMailer({ send: async () => { throw new Error("SMTP down"); } });
    expect((await post(enquiries.POST, quote("shown-ore"))).status).toBe(201);
    expect(await db().contactEnquiry.count()).toBe(1);
  });
});

describe("the company mailbox gets every form", () => {
  it("is SMTP_USER, or the address inside MAIL_FROM for a server with no sign-in, or nothing", () => {
    expect(getNotificationAddress()).toBe(MAILBOX);
    delete process.env.SMTP_USER;
    process.env.MAIL_FROM = "Hamsavahin <info@hamsavahin.test>";
    expect(getNotificationAddress()).toBe("info@hamsavahin.test");
    process.env.MAIL_FROM = "not an address";
    expect(getNotificationAddress()).toBeNull();
    delete process.env.MAIL_FROM;
    process.env.SMTP_USER = MAILBOX;
  });

  it("the contact form and the quotation form also e-mail the mailbox, replying to the visitor", async () => {
    await post(enquiries.POST, { name: "Lars", email: "lars@nordic.test", phone: "+47 22 00 00 00", subject: "Price list", message: "Please send your price list for manganese.", consent: true });
    await post(rfqs.POST, { companyName: "Nordic Alloys", contactName: "Lars", email: "lars@nordic.test", phone: "+47 22 00 00 00", country: "Norway", requirement: "Manganese ore", quantity: 2500, quantityUnit: "MT", incoterm: "CIF", deliveryPort: "Rotterdam", message: "Spot requirement.", consent: true });
    const staff = to(MAILBOX);
    expect(staff).toHaveLength(2);
    expect(staff.map((m) => m.subject).join(" | ")).toMatch(/New enquiry: Price list.*New quotation request RFQ-/);
    expect(staff.every((m) => m.replyTo === "lars@nordic.test")).toBe(true);
  });

  it("sends nothing to a mailbox when none is configured, and the forms still work", async () => {
    delete process.env.SMTP_USER;
    delete process.env.MAIL_FROM;
    const r = await post(enquiries.POST, { name: "Lars", email: "lars2@nordic.test", phone: "1", subject: "Hello there", message: "Just saying hello to the team.", consent: true });
    expect(r.status).toBe(201);
    expect(to(MAILBOX)).toHaveLength(0);
    process.env.SMTP_USER = MAILBOX;
  });
});
