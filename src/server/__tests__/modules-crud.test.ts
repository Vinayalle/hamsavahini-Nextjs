import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db";
import { call, ensurePermissions, loginCookie, makeRole, makeUser } from "./helpers";
import * as listRoute from "@/app/api/[resource]/route";
import * as itemRoute from "@/app/api/[resource]/[id]/route";
import * as bulkRoute from "@/app/api/[resource]/bulk/route";
import * as attention from "@/app/api/dashboard/attention/route";
import * as searchRoute from "@/app/api/search/route";

/**
 * End-to-end behaviour of every generic CMS module through the real route handlers against PostgreSQL:
 * create / read / update / delete, persistence in the database, validation, uniqueness, delete guards, workflow permissions,
 * server-assigned note authors, append-only logs, and the shell helpers (attention counts, global search).
 */
type H = Parameters<typeof call>[0];
const db = () => getDb();
const ck: Record<string, string> = {};
const uid: Record<string, string> = {};

const list = (resource: string, cookie?: string, qs = "") => call(listRoute.GET as H, { url: `/api/${resource}${qs}`, cookie, params: { resource } });
const create = (resource: string, cookie: string | undefined, body: unknown) => call(listRoute.POST as H, { method: "POST", url: `/api/${resource}`, cookie, body, params: { resource } });
const one = (method: "GET" | "PATCH" | "DELETE", resource: string, id: string, cookie?: string, body?: unknown) =>
  call((itemRoute as unknown as Record<string, H>)[method], { method, url: `/api/${resource}/${id}`, cookie, body: method === "PATCH" ? (body ?? {}) : undefined, params: { resource, id } });
const bulk = (resource: string, cookie: string | undefined, body: unknown) => call(bulkRoute.POST as H, { method: "POST", url: `/api/${resource}/bulk`, cookie, body, params: { resource } });

let commodityId = "";
const P = {
  post: { title: "Copper outlook Q1", slug: "copper-outlook-q1", excerpt: "A short summary of the quarter ahead for copper markets.", content: "<p>Long enough body text for the validation rule to pass.</p>", category: "Market Insight", author: "Trade desk", tags: ["copper"], seo: { metaTitle: "Copper", metaDescription: "Outlook", keywords: ["copper"] }, status: "draft" },
  project: { title: "Cathode shipment Chile", slug: "cathode-shipment-chile", client: "Acme Metals", commodity: "Copper", region: "South America", summary: "Delivered 12,000 MT of cathode to East Asia.", content: "<p>The story of a long-running supply arrangement.</p>", startDate: "2026-01-01", endDate: null, projectStatus: "active", status: "draft", featured: false },
  career: { title: "Trade analyst", slug: "trade-analyst", department: "Trading", location: "Mumbai, India", employmentType: "full_time", experience: "3+ years", description: "<p>Analyse physical commodity flows and prepare reports.</p>", requirements: "<p>Degree plus strong Excel skills.</p>", deadline: "2027-02-01", openings: 2, status: "draft" },
  location: { name: "Mundra Terminal", type: "port_terminal", country: "India", city: "Mundra", address: "Port Road, Mundra, Gujarat", description: "Bulk handling terminal", phone: "+91 20000000", email: "mundra@example.test", active: true },
  banner: { title: "Global supply, local trust", subtitle: "Metals and minerals", section: "hero", ctaLabel: "Explore", ctaUrl: "/products", sortOrder: 1, status: "draft" },
  commodity: { name: "Copper Cathode", slug: "copper-cathode", code: "cu1", group: "Metals", unit: "MT", description: "LME grade A copper cathode", status: "draft" },
  template: { key: "enquiry_ack", name: "Enquiry acknowledgement", subject: "Hello {{name}}", body: "Dear {{name}}, we received {{reference}}. Thank you for writing to us.", active: true },
};

beforeAll(async () => {
  await ensurePermissions();
  const d = db();
  await d.adminUser.deleteMany();
  await d.role.deleteMany();
  const sa = await makeRole("Super Admin", {}, true);
  // editor: can create/edit but NOT publish, delete, change status, assign
  const editor = await makeRole("Editor", Object.fromEntries(["posts", "projects", "careers", "locations", "banners", "commodities", "commodity_prices", "trade_opportunities", "email_templates"].map((r) => [r, ["view", "create", "edit"]])));
  const triage = await makeRole("Triage", { rfqs: ["view", "edit", "change_status", "assign"], enquiries: ["view", "edit", "change_status", "assign"], job_applications: ["view", "edit", "change_status"] });
  const noStatus = await makeRole("No status", { rfqs: ["view", "edit"], enquiries: ["view", "edit"], job_applications: ["view", "edit"] });
  const logViewer = await makeRole("Log viewer", { activity_logs: ["view"], notification_history: ["view", "change_status"] });
  const assignedOnly = await makeRole("Assigned only", { rfqs: ["view", "edit", "change_status"], enquiries: ["view"] }, { scopes: { rfqs: "assigned", enquiries: "assigned" } });
  uid.sa = (await makeUser("sa@c.dev", sa.id)).id;
  uid.editor = (await makeUser("editor@c.dev", editor.id)).id;
  uid.triage = (await makeUser("triage@c.dev", triage.id)).id;
  uid.nostatus = (await makeUser("nostatus@c.dev", noStatus.id)).id;
  uid.logs = (await makeUser("logs@c.dev", logViewer.id)).id;
  uid.assigned = (await makeUser("assigned@c.dev", assignedOnly.id)).id;
  uid.gone = (await makeUser("gone@c.dev", triage.id, "suspended")).id;
  uid.noaccess = (await makeUser("noaccess@c.dev", (await makeRole("Nothing", {})).id)).id;
  for (const k of ["sa", "editor", "triage", "nostatus", "logs", "assigned", "noaccess"]) ck[k] = await loginCookie(`${k}@c.dev`);
});

beforeEach(async () => {
  const d = db();
  await d.activityLog.deleteMany({ where: { entityType: { not: "Session" } } });
});

/* ───────────────────────── CRUD per module ───────────────────────── */
interface Case {
  resource: string; model: string; payload: () => Record<string, unknown>; patch: Record<string, unknown>; expectDb: (row: Record<string, unknown>) => void;
  invalid: Record<string, unknown>; field: string; searchTerm: string; unique?: { field: string };
}
const cases: Case[] = [
  { resource: "posts", model: "post", payload: () => P.post, patch: { title: "Copper outlook Q1 (updated)", tags: ["copper", "q1"] }, expectDb: (r) => expect(r.title).toBe("Copper outlook Q1 (updated)"), invalid: { ...P.post, title: "" }, field: "title", searchTerm: "outlook", unique: { field: "slug" } },
  { resource: "projects", model: "project", payload: () => P.project, patch: { client: "Beta Metals", featured: true }, expectDb: (r) => expect(r.featured).toBe(true), invalid: { ...P.project, endDate: "2025-01-01" }, field: "endDate", searchTerm: "Chile", unique: { field: "slug" } },
  { resource: "careers", model: "career", payload: () => P.career, patch: { openings: 5, location: "Delhi, India" }, expectDb: (r) => expect(r.openings).toBe(5), invalid: { ...P.career, openings: 0 }, field: "openings", searchTerm: "analyst", unique: { field: "slug" } },
  { resource: "locations", model: "location", payload: () => P.location, patch: { capacity: "2 million MT", active: false }, expectDb: (r) => expect(r.active).toBe(false), invalid: { ...P.location, email: "nope" }, field: "email", searchTerm: "Mundra" },
  { resource: "banners", model: "banner", payload: () => P.banner, patch: { sortOrder: 4, subtitle: "Updated" }, expectDb: (r) => expect(r.sortOrder).toBe(4), invalid: { ...P.banner, ctaUrl: "javascript:alert(1)" }, field: "ctaUrl", searchTerm: "Global supply" },
  { resource: "commodities", model: "commodity", payload: () => P.commodity, patch: { unit: "DMT" }, expectDb: (r) => expect(r.unit).toBe("DMT"), invalid: { ...P.commodity, code: "bad code!" }, field: "code", searchTerm: "CU1", unique: { field: "code" } },
  { resource: "email-templates", model: "emailTemplate", payload: () => P.template, patch: { subject: "Hi {{name}} - {{reference}}" }, expectDb: (r) => expect(r.variables).toEqual(["name", "reference"]), invalid: { ...P.template, key: "Bad Key" }, field: "key", searchTerm: "acknowledgement", unique: { field: "key" } },
];

describe.each(cases)("$resource: create, read, update, delete against PostgreSQL", (c) => {
  it("persists every operation and writes the audit trail", async () => {
    const created = await create(c.resource, ck.sa, c.payload());
    expect(created.status, JSON.stringify(created.data)).toBe(201);
    const id = created.data.id as string;
    // the row really is in the database
    const delegate = (db() as unknown as Record<string, { findUnique: (a: unknown) => Promise<Record<string, unknown> | null>; count: (a?: unknown) => Promise<number> }>)[c.model];
    expect(await delegate.findUnique({ where: { id } })).not.toBeNull();
    // read back
    const got = await one("GET", c.resource, id, ck.sa);
    expect(got.status).toBe(200);
    expect(got.data.id).toBe(id);
    // listed, and found by server-side search
    expect((await list(c.resource, ck.sa)).data.items.map((i: { id: string }) => i.id)).toContain(id);
    expect((await list(c.resource, ck.sa, `?search=${encodeURIComponent(c.searchTerm)}`)).data.total).toBeGreaterThanOrEqual(1);
    expect((await list(c.resource, ck.sa, "?search=zzz-no-such-record-zzz")).data.total).toBe(0);
    // update (PATCH semantics: omitted fields are untouched)
    const upd = await one("PATCH", c.resource, id, ck.sa, c.patch);
    expect(upd.status, JSON.stringify(upd.data)).toBe(200);
    c.expectDb((await delegate.findUnique({ where: { id } }))!);
    const afterTitle = (await one("GET", c.resource, id, ck.sa)).data;
    expect(afterTitle[Object.keys(c.patch)[0]]).toEqual(Object.values(c.patch)[0]);
    // delete
    expect((await one("DELETE", c.resource, id, ck.sa)).status).toBe(200);
    expect(await delegate.findUnique({ where: { id } })).toBeNull();
    expect((await one("GET", c.resource, id, ck.sa)).status).toBe(404);
    const trail = await db().activityLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "asc" } });
    expect(trail.map((t) => t.action)).toEqual(["created", "updated", "deleted"]);
    expect(trail.every((t) => t.actorId === uid.sa)).toBe(true);
  });

  it("rejects invalid input with field errors, creating nothing", async () => {
    const before = await (db() as never as Record<string, { count: () => Promise<number> }>)[c.model].count();
    const r = await create(c.resource, ck.sa, c.invalid);
    expect(r.status).toBe(422);
    expect(r.data.error.fields[c.field], JSON.stringify(r.data)).toBeTruthy();
    expect(await (db() as never as Record<string, { count: () => Promise<number> }>)[c.model].count()).toBe(before);
  });

  it("only an authorised employee can write, and nothing leaks to others", async () => {
    expect((await create(c.resource, ck.noaccess, c.payload())).status).toBe(403);
    const made = await create(c.resource, ck.editor, { ...c.payload(), ...(c.resource === "locations" ? { active: false } : {}) }); // showing a location on the website needs publish
    expect(made.status, JSON.stringify(made.data)).toBe(201); // editor holds create
    expect((await one("DELETE", c.resource, made.data.id, ck.editor)).status).toBe(403); // but not delete
    expect((await one("DELETE", c.resource, made.data.id, ck.sa)).status).toBe(200);
  });

  if (c.unique) {
    it(`refuses a duplicate ${c.unique.field} with 409 and a field error`, async () => {
      const a = await create(c.resource, ck.sa, c.payload());
      expect(a.status).toBe(201);
      const b = await create(c.resource, ck.sa, c.payload());
      expect(b.status).toBe(409);
      expect(b.data.error.fields[c.unique!.field]).toBeTruthy();
      await one("DELETE", c.resource, a.data.id, ck.sa);
    });
  }
});

/**
 * Regression: zod's .partial() re-applies .default() to omitted fields, so a PATCH of one field used to reset status to draft,
 * active to true, tags to [] ... Every module must leave fields that were not sent untouched.
 */
describe("a partial update never resets fields that were not sent", () => {
  const nonDefault: Record<string, Record<string, unknown>> = {
    posts: { status: "published", tags: ["a", "b"], seo: { metaTitle: "T", metaDescription: "D", keywords: ["k"] } },
    careers: { status: "open", openings: 7 },
    locations: { active: false, description: "Kept description" },
    commodities: { status: "published" },
    "email-templates": { active: false },
  };
  it.each(cases.filter((c) => nonDefault[c.resource]))("$resource", async (c) => {
    const created = await create(c.resource, ck.sa, { ...c.payload(), ...nonDefault[c.resource] });
    expect(created.status, JSON.stringify(created.data)).toBe(201);
    const before = (await one("GET", c.resource, created.data.id, ck.sa)).data;
    const patchKey = c.resource === "locations" ? "capacity" : c.resource === "email-templates" ? "name" : "title" in before ? "title" : "name";
    const patchValue = patchKey === "capacity" ? "Large" : `${before[patchKey]} v2`;
    expect((await one("PATCH", c.resource, created.data.id, ck.sa, { [patchKey]: patchValue })).status).toBe(200);
    const after = (await one("GET", c.resource, created.data.id, ck.sa)).data;
    for (const [k, v] of Object.entries(before)) {
      if (k === "updatedAt" || k === patchKey || k === "slug" || k === "variables") continue; // slug/variables may follow the changed field
      expect(after[k], `${c.resource}.${k} must be unchanged`).toEqual(v);
    }
    await one("DELETE", c.resource, created.data.id, ck.sa);
  });
});

describe("publishing needs the publish permission", () => {
  it("an editor can save drafts but cannot publish, archive or bulk-publish", async () => {
    const draft = await create("posts", ck.editor, { ...P.post, slug: "pub-test" });
    expect(draft.status).toBe(201);
    expect((await create("posts", ck.editor, { ...P.post, slug: "pub-test-2", status: "published" })).status).toBe(403);
    expect((await one("PATCH", "posts", draft.data.id, ck.editor, { status: "published" })).status).toBe(403);
    expect((await bulk("posts", ck.editor, { action: "status", ids: [draft.data.id], status: "published" })).status).toBe(403);
    expect((await db().post.findUniqueOrThrow({ where: { id: draft.data.id } })).status).toBe("draft");
    const pub = await one("PATCH", "posts", draft.data.id, ck.sa, { status: "published" });
    expect(pub.status).toBe(200);
    expect(pub.data.publishedAt).toBeTruthy();
    expect((await bulk("posts", ck.sa, { action: "delete", ids: [draft.data.id] })).data.count).toBe(1);
  });
});

/* ───────────────────────── delete guards and relations ───────────────────────── */
describe("delete guards keep related data safe", () => {
  it("a job opening with applications cannot be deleted; a commodity with prices cannot be deleted", async () => {
    const career = await create("careers", ck.sa, { ...P.career, slug: "guard-career" });
    await db().jobApplication.create({ data: { careerId: career.data.id, applicantName: "Rita", email: "r@x.dev", phone: "1", experienceYears: 2 } });
    const del = await one("DELETE", "careers", career.data.id, ck.sa);
    expect(del.status).toBe(409);
    expect(del.data.error.message).toMatch(/application/);
    expect((await bulk("careers", ck.sa, { action: "delete", ids: [career.data.id] })).status).toBe(409);

    const com = await create("commodities", ck.sa, { ...P.commodity, slug: "guard-com", code: "GRD" });
    commodityId = com.data.id;
    const price = await create("commodity-prices", ck.sa, { commodityId, price: 9500.5, currency: "CNY", unit: "MT", market: "LME", effectiveDate: "2026-10-01", status: "draft" });
    expect(price.status, JSON.stringify(price.data)).toBe(201);
    expect(price.data.currency).toBe("CNY");
    expect(price.data.price).toBe(9500.5);
    expect((await one("DELETE", "commodities", commodityId, ck.sa)).status).toBe(409);
    expect((await create("commodity-prices", ck.sa, { commodityId, price: 1, currency: "USD", unit: "MT", market: "LME", effectiveDate: "2026-10-01" })).status).toBe(409); // same commodity+market+date
    expect((await create("commodity-prices", ck.sa, { commodityId, price: 0, currency: "USD", unit: "MT", market: "X", effectiveDate: "2026-10-02" })).data.error.fields.price).toBeTruthy();
    expect((await create("commodity-prices", ck.sa, { commodityId: "11111111-1111-4111-8111-111111111111", price: 1, currency: "USD", unit: "MT", market: "X", effectiveDate: "2026-10-02" })).status).toBeGreaterThanOrEqual(400);
  });

  it("trade opportunities parse quantity and follow the PDF workflow vocabulary", async () => {
    const opp = await create("trade-opportunities", ck.sa, { title: "Offer 5,000 MT copper", commodityId, type: "sell", category: "spot", quantity: "5,000 MT", originRegion: "Chile", destinationRegion: "China", incoterm: "CIF", validUntil: "2027-01-01", description: "Prompt shipment offer", status: "available" });
    expect(opp.status, JSON.stringify(opp.data)).toBe(201);
    expect(opp.data.quantity).toBe("5,000 MT");
    const row = await db().tradeOpportunity.findUniqueOrThrow({ where: { id: opp.data.id } });
    expect(Number(row.quantityValue)).toBe(5000);
    expect(row.quantityUnit).toBe("MT");
    expect((await one("PATCH", "trade-opportunities", opp.data.id, ck.sa, { status: "under_negotiation" })).data.status).toBe("under_negotiation");
    expect((await one("PATCH", "trade-opportunities", opp.data.id, ck.sa, { status: "open" })).status).toBe(422); // old mock vocabulary is refused
    expect((await create("trade-opportunities", ck.sa, { title: "x", commodityId, type: "sell", quantity: "lots", originRegion: "a", destinationRegion: "b", incoterm: "CIF", validUntil: "2027-01-01", description: "Details here" })).status).toBe(422);
    expect((await one("PATCH", "trade-opportunities", opp.data.id, ck.editor, { status: "sold" })).status).toBe(403); // editor lacks change_status
  });
});

/* ───────────────────────── inbound workflows (RFQs, enquiries, applications) ───────────────────────── */
describe("RFQs, enquiries and applications", () => {
  let rfq = "";
  let enquiry = "";
  let app = "";
  let careerId = "";
  beforeEach(async () => {
    const d = db();
    await d.rfq.deleteMany();
    await d.contactEnquiry.deleteMany();
    await d.jobApplication.deleteMany();
    rfq = (await d.rfq.create({ data: { reference: `RFQ-C-${Math.random().toString(36).slice(2, 8)}`, companyName: "Co", contactName: "Contact", email: "c@x.dev", phone: "1", country: "IN", requirement: "Copper", quantity: 5, quantityUnit: "MT", incoterm: "CIF", deliveryPort: "Mumbai", message: "hello", assignedToId: uid.assigned } })).id;
    enquiry = (await d.contactEnquiry.create({ data: { name: "Marta", email: "m@x.dev", subject: "Partnership", message: "Hi", source: "contact_page" } })).id;
    careerId = (await d.career.findFirst())?.id ?? (await create("careers", ck.sa, { ...P.career, slug: "wf-career" })).data.id;
    app = (await d.jobApplication.create({ data: { careerId, applicantName: "Aarav", email: "a@x.dev", phone: "1", experienceYears: 4 } })).id;
  });

  it("an RFQ status change needs change_status", async () => {
    expect((await one("PATCH", "rfqs", rfq, ck.nostatus, { status: "contacted" })).status).toBe(403);
    expect((await db().rfq.findUniqueOrThrow({ where: { id: rfq } })).status).toBe("new");
  });

  it("walks an RFQ through the workflow and stores the result", async () => {
    // triage can see all RFQs
    const moved = await one("PATCH", "rfqs", rfq, ck.triage, { status: "contacted" });
    expect(moved.status, JSON.stringify(moved.data)).toBe(200);
    expect((await db().rfq.findUniqueOrThrow({ where: { id: rfq } })).status).toBe("contacted");
    for (const s of ["under_discussion", "quotation_sent", "closed"]) expect((await one("PATCH", "rfqs", rfq, ck.triage, { status: s })).data.status).toBe(s);
    expect((await one("PATCH", "rfqs", rfq, ck.triage, { status: "won" })).status).toBe(422); // retired vocabulary
    expect((await db().activityLog.count({ where: { entityId: rfq, action: "status_changed" } }))).toBe(4);
  });

  it("an employee without change_status or assign cannot use those controls", async () => {
    expect((await one("PATCH", "enquiries", enquiry, ck.nostatus, { status: "contacted" })).status).toBe(403);
    expect((await one("PATCH", "enquiries", enquiry, ck.nostatus, { assignedToId: uid.triage })).status).toBe(403);
    expect((await one("PATCH", "applications", app, ck.nostatus, { status: "screening" })).status).toBe(403);
    expect((await db().contactEnquiry.findUniqueOrThrow({ where: { id: enquiry } })).status).toBe("new");
    expect((await one("PATCH", "enquiries", enquiry, ck.triage, { status: "contacted", assignedToId: uid.triage })).status).toBe(200);
  });

  it("assignees must be active employees who can see these records", async () => {
    expect((await one("PATCH", "enquiries", enquiry, ck.triage, { assignedToId: uid.gone })).status).toBe(422); // deactivated
    expect((await one("PATCH", "enquiries", enquiry, ck.triage, { assignedToId: uid.noaccess })).status).toBe(422); // no access
    expect((await one("PATCH", "enquiries", enquiry, ck.triage, { assignedToId: "11111111-1111-4111-8111-111111111111" })).status).toBe(422);
    expect((await one("PATCH", "enquiries", enquiry, ck.triage, { assignedToId: null })).status).toBe(200);
  });

  it("notes are appended by the server: the author is always the signed-in employee and the client cannot spoof or rewrite history", async () => {
    const first = await one("PATCH", "enquiries", enquiry, ck.triage, { notes: [{ text: "Called the customer", author: "Somebody Else", createdAt: "2001-01-01T00:00:00Z" }] });
    expect(first.status, JSON.stringify(first.data)).toBe(200);
    expect(first.data.notes).toHaveLength(1);
    expect(first.data.notes[0].author).toBe("triage");
    expect(new Date(first.data.notes[0].createdAt).getFullYear()).toBeGreaterThan(2020);
    const kept = first.data.notes[0];
    // sending the existing note back plus a new one adds only the new one; an edited copy of the old text is ignored
    const second = await one("PATCH", "enquiries", enquiry, ck.triage, { notes: [{ id: kept.id, text: "REWRITTEN" }, { text: "Second note" }] });
    expect(second.data.notes.map((n: { text: string }) => n.text)).toEqual(["Called the customer", "Second note"]);
    expect(await db().enquiryNote.count({ where: { enquiryId: enquiry } })).toBe(2);
    expect((await one("PATCH", "enquiries", enquiry, ck.nostatus, { notes: [{ text: "Allowed: edit permission" }] })).status).toBe(200);
  });

  it("applications: status workflow, notes and the CV filename, never the storage key", async () => {
    const moved = await one("PATCH", "applications", app, ck.triage, { status: "screening" });
    expect(moved.status).toBe(200);
    expect((await one("PATCH", "applications", app, ck.triage, { status: "rejected", notes: [{ text: "Not a fit" }] })).data.notes[0].text).toBe("Not a fit");
    expect((await list("applications", ck.triage, "?status=open")).data.total).toBe(0);
    expect((await list("applications", ck.triage, `?careerId=${careerId}`)).data.total).toBe(1);
    expect(JSON.stringify((await one("GET", "applications", app, ck.triage)).data)).not.toMatch(/storageKey/);
  });

  it("an employee restricted to ASSIGNED records sees and changes only their own", async () => {
    expect((await list("rfqs", ck.assigned)).data.total).toBe(1);
    expect((await one("PATCH", "rfqs", rfq, ck.assigned, { status: "contacted" })).status).toBe(200);
    expect((await list("enquiries", ck.assigned)).data.total).toBe(0); // the enquiry is unassigned
    expect((await one("GET", "enquiries", enquiry, ck.assigned)).status).toBe(404);
    const b = await bulk("rfqs", ck.assigned, { action: "status", ids: [rfq], status: "closed" });
    expect(b.status).toBe(200);
    expect(b.data.count).toBe(1);
    await db().rfq.update({ where: { id: rfq }, data: { assignedToId: uid.triage } });
    expect((await bulk("rfqs", ck.assigned, { action: "status", ids: [rfq], status: "new" })).data.count).toBe(0); // no longer theirs
  });
});

/* ───────────────────────── notification history and activity logs ───────────────────────── */
describe("notification history and activity logs", () => {
  it("activity logs are read-only for everyone, including a Super Admin", async () => {
    await create("posts", ck.sa, { ...P.post, slug: "log-test" });
    const rows = await list("activity-logs", ck.logs);
    expect(rows.status).toBe(200);
    expect(rows.data.total).toBeGreaterThan(0);
    const id = rows.data.items[0].id;
    for (const who of ["sa", "logs", "editor"]) {
      expect([403, 405]).toContain((await create("activity-logs", ck[who], { entityLabel: "forged" })).status);
      expect([403, 405]).toContain((await one("PATCH", "activity-logs", id, ck[who], { detail: "edited" })).status);
      expect([403, 405]).toContain((await one("DELETE", "activity-logs", id, ck[who])).status);
      expect([403, 405]).toContain((await bulk("activity-logs", ck[who], { action: "delete", ids: [id] })).status);
    }
    expect(await db().activityLog.count({ where: { entityLabel: "forged" } })).toBe(0);
    expect(await db().activityLog.findUnique({ where: { id } })).not.toBeNull();
    expect((await list("activity-logs", ck.editor)).status).toBe(403);
    expect(JSON.stringify(rows.data)).not.toMatch(/passwordHash|secret|token/i);
  });

  it("activity log filtering and paging happen on the server", async () => {
    const d = db();
    await d.activityLog.createMany({ data: Array.from({ length: 30 }, (_, i) => ({ actorName: "Seeder", action: i % 2 ? "created" : "updated", entityType: "Seed", entityLabel: `seed-${i}` })) });
    const page = await list("activity-logs", ck.logs, "?pageSize=10&page=2&action=created&search=seed&sortBy=createdAt&sortDir=asc");
    expect(page.data.items).toHaveLength(5);
    expect(page.data.total).toBe(15);
    expect(page.data.pageCount).toBe(2);
    expect(page.data.items.every((i: { action: string }) => i.action === "created")).toBe(true);
  });

  it("failed notifications can be marked for retry; others cannot; nothing can be deleted", async () => {
    await db().notificationLog.deleteMany(); // other test files share this database
    const failed = await db().notificationLog.create({ data: { templateKey: "t", recipient: "a@x.dev", subject: "Failed one", status: "failed", error: "boom", attempts: 1 } });
    const sent = await db().notificationLog.create({ data: { templateKey: "t", recipient: "a@x.dev", subject: "Sent one", status: "sent", attempts: 1 } });
    expect((await one("PATCH", "notifications", sent.id, ck.logs, { status: "queued" })).status).toBe(409);
    const r = await one("PATCH", "notifications", failed.id, ck.logs, { status: "queued" });
    expect(r.status).toBe(200);
    expect(r.data.status).toBe("queued");
    expect(r.data.error).toBeUndefined();
    expect((await db().notificationLog.findUniqueOrThrow({ where: { id: failed.id } })).attempts).toBe(2);
    expect((await one("PATCH", "notifications", failed.id, ck.logs, { status: "sent" })).status).toBe(422); // cannot fake "sent"
    expect([403, 405]).toContain((await one("DELETE", "notifications", failed.id, ck.sa)).status);
    expect((await one("PATCH", "notifications", failed.id, ck.editor, { status: "queued" })).status).toBe(403);
    expect((await list("notifications", ck.logs, "?status=sent")).data.items.map((i: { subject: string }) => i.subject)).toEqual(["Sent one"]);
  });
});

/* ───────────────────────── shell helpers: attention counts and global search ───────────────────────── */
describe("attention counts and global search honour permissions and scope", () => {
  beforeEach(async () => {
    const d = db();
    await d.rfq.deleteMany();
    await d.contactEnquiry.deleteMany();
    await d.jobApplication.deleteMany();
    const base = { companyName: "Searchable Metals", contactName: "C", email: "c@x.dev", phone: "1", country: "IN", requirement: "Copper", quantity: 5, quantityUnit: "MT", incoterm: "CIF", deliveryPort: "Mumbai", message: "hi" };
    await d.rfq.create({ data: { ...base, reference: "RFQ-S-1", assignedToId: uid.assigned } });
    await d.rfq.create({ data: { ...base, reference: "RFQ-S-2" } });
    await d.contactEnquiry.create({ data: { name: "Searchable Person", email: "p@x.dev", subject: "Hello", message: "m", source: "contact_page" } });
  });

  it("counts only what the employee may see", async () => {
    const sa = await call(attention.GET as H, { url: "/api/dashboard/attention", cookie: ck.sa });
    expect(sa.data).toEqual({ rfqs: 2, enquiries: 1, applications: 0 });
    const scoped = await call(attention.GET as H, { url: "/api/dashboard/attention", cookie: ck.assigned });
    expect(scoped.data).toEqual({ rfqs: 1, enquiries: 0, applications: null });
    const none = await call(attention.GET as H, { url: "/api/dashboard/attention", cookie: ck.noaccess });
    expect(none.data).toEqual({ rfqs: null, enquiries: null, applications: null });
    expect((await call(attention.GET as H, { url: "/api/dashboard/attention" })).status).toBe(401);
  });

  it("searches only permitted modules and records", async () => {
    const find = (cookie?: string, q = "Searchable") => call(searchRoute.GET as H, { url: `/api/search?q=${q}`, cookie });
    const all = (await find(ck.sa)).data.items.map((i: { hint: string }) => i.hint);
    expect(all).toEqual(expect.arrayContaining(["RFQ", "Enquiry"]));
    expect((await find(ck.assigned)).data.items.map((i: { label: string }) => i.label)).toEqual(["RFQ-S-1 · Searchable Metals"]);
    expect((await find(ck.noaccess)).data.items).toEqual([]);
    expect((await find(ck.sa, "x")).data.items).toEqual([]); // too short
    expect((await find()).status).toBe(401);
  });
});
