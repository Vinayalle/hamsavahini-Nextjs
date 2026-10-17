import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setStorageForTests } from "@/server/storage";
import { getDb } from "@/server/db";
import { RESOURCES } from "@/server/resources";
import { getResource as getResourceDef } from "@/lib/authz/catalog";
import { call, ensurePermissions, loginCookie, makeRole, makeUser } from "./helpers";
import * as listRoute from "@/app/api/[resource]/route";
import * as itemRoute from "@/app/api/[resource]/[id]/route";
import * as settingsRoute from "@/app/api/settings/[section]/route";
import * as assignees from "@/app/api/assignees/route";
import * as resume from "@/app/api/applications/[id]/resume/route";

type H = Parameters<typeof call>[0];
const db = () => getDb();
const UUID = "11111111-1111-4111-8111-111111111111";
const keys = Object.keys(RESOURCES);
const ck: Record<string, string> = {};
const uid: Record<string, string> = {};

beforeAll(async () => {
  await ensurePermissions();
  const d = db();
  await d.adminUser.deleteMany();
  await d.role.deleteMany();
  const sa = await makeRole("Super Admin", {}, true);
  // one read-only role per module permission + a role that holds nothing
  const perms = [...new Set(Object.values(RESOURCES).map((r) => r.permission))];
  const viewAll = await makeRole("View everything", Object.fromEntries(perms.map((p) => [p, ["view"]])));
  const nothing = await makeRole("Nothing", {});
  const assignedOnly = await makeRole("Assigned only", { rfqs: ["view", "edit"], enquiries: ["view", "edit"] }, { scopes: { rfqs: "assigned", enquiries: "assigned" } });
  const settingsView = await makeRole("Settings viewer", { settings_general: ["view"] });
  const settingsAdmin = await makeRole("Settings admin", { settings_general: ["view", "manage_settings"], settings_seo: ["view", "manage_settings"] });
  const assigner = await makeRole("Assigner", { rfqs: ["view", "assign"] });
  const hr = await makeRole("HR downloader", { job_applications: ["view", "download"] });
  const hrNoDl = await makeRole("HR no download", { job_applications: ["view"] });
  uid.sa = (await makeUser("sa@m.dev", sa.id)).id;
  uid.view = (await makeUser("view@m.dev", viewAll.id)).id;
  uid.none = (await makeUser("none@m.dev", nothing.id)).id;
  uid.assigned = (await makeUser("assigned@m.dev", assignedOnly.id)).id;
  uid.sview = (await makeUser("sview@m.dev", settingsView.id)).id;
  uid.sadmin = (await makeUser("sadmin@m.dev", settingsAdmin.id)).id;
  uid.assigner = (await makeUser("assigner@m.dev", assigner.id)).id;
  uid.hr = (await makeUser("hr@m.dev", hr.id)).id;
  uid.hrnd = (await makeUser("hrnd@m.dev", hrNoDl.id)).id;
  for (const k of ["sa", "view", "none", "assigned", "sview", "sadmin", "assigner", "hr", "hrnd"]) ck[k] = await loginCookie(`${k}@m.dev`);
});

const list = (resource: string, cookie?: string, qs = "") => call(listRoute.GET as H, { url: `/api/${resource}${qs}`, cookie, params: { resource } });
const create = (resource: string, cookie: string | undefined, body: unknown = {}) => call(listRoute.POST as H, { method: "POST", url: `/api/${resource}`, cookie, body, params: { resource } });
const one = (method: string, resource: string, id: string, cookie?: string, body?: unknown) => call((itemRoute as unknown as Record<string, H>)[method], { method, url: `/api/${resource}/${id}`, cookie, body: method === "GET" || method === "DELETE" ? undefined : (body ?? {}), params: { resource, id } });

describe("every generic CMS module is protected on the server", () => {
  it("registers the expected modules, each with a catalogued permission", () => {
    expect(keys.sort()).toEqual(["activity-logs", "applications", "banners", "careers", "commodities", "commodity-prices", "documents", "email-templates", "enquiries", "locations", "media", "notifications", "posts", "projects", "rfqs", "trade-opportunities"]);
    for (const r of Object.values(RESOURCES)) expect(getResourceDef(r.permission), r.key).toBeTruthy();
  });

  it.each(keys)("%s: anonymous callers get 401 on every method", async (resource) => {
    expect((await list(resource)).status).toBe(401);
    expect((await create(resource, undefined)).status).toBe(401);
    for (const m of ["GET", "PATCH", "DELETE"]) expect((await one(m, resource, UUID)).status).toBe(401);
  });

  it.each(keys)("%s: an employee with no permission gets 403 (never field errors, never 404)", async (resource) => {
    expect((await list(resource, ck.none)).status).toBe(403);
    expect((await create(resource, ck.none, {})).status).toBe(403);
    for (const m of ["GET", "PATCH", "DELETE"]) {
      const r = await one(m, resource, UUID, ck.none);
      expect(r.status, `${m} ${resource}`).toBe(403);
      expect(r.data.error.code).toBe("forbidden");
    }
  });

  it.each(keys)("%s: a view-only employee can list but cannot create, edit or delete", async (resource) => {
    expect((await list(resource, ck.view)).status).toBe(200);
    const c = await create(resource, ck.view, {});
    expect([403, 405]).toContain(c.status); // read-only modules answer 405 only AFTER authorization; here the 403 wins
    expect([403, 405]).toContain((await one("PATCH", resource, UUID, ck.view)).status);
    expect([403, 405]).toContain((await one("DELETE", resource, UUID, ck.view)).status);
  });

  it.each(keys)("%s: a Super Admin can list", async (resource) => {
    const r = await list(resource, ck.sa);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ items: expect.any(Array), total: expect.any(Number) });
  });

  it("rejects an unknown resource name without leaking anything", async () => {
    expect((await list("passwordHash", ck.sa)).status).toBe(404);
    expect((await list("__proto__", ck.sa)).status).toBe(404);
    expect((await list("constructor", ck.sa)).status).toBe(404);
  });

  it("malformed ids look like missing records", async () => {
    expect((await one("GET", "posts", "not-a-uuid", ck.sa)).status).toBe(404);
  });
});

describe("record-level scope: employees limited to ASSIGNED records", () => {
  let mine = "";
  let theirs = "";
  let unassigned = "";
  beforeEach(async () => {
    const d = db();
    await d.rfq.deleteMany();
    const base = { companyName: "Co", contactName: "C", email: "c@x.dev", phone: "1", country: "IN", requirement: "Copper", quantity: 5, quantityUnit: "MT", incoterm: "CIF", deliveryPort: "Mumbai", message: "hi" };
    mine = (await d.rfq.create({ data: { ...base, reference: "RFQ-T-1", assignedToId: uid.assigned } })).id;
    theirs = (await d.rfq.create({ data: { ...base, reference: "RFQ-T-2", assignedToId: uid.assigner } })).id;
    unassigned = (await d.rfq.create({ data: { ...base, reference: "RFQ-T-3" } })).id;
  });

  it("lists only the records assigned to the caller", async () => {
    const r = await list("rfqs", ck.assigned);
    expect(r.status).toBe(200);
    expect(r.data.items.map((i: { id: string }) => i.id)).toEqual([mine]);
    expect(r.data.total).toBe(1);
    expect((await list("rfqs", ck.sa)).data.total).toBe(3);
  });
  it("search cannot be used to see other people's records", async () => {
    const r = await list("rfqs", ck.assigned, "?search=RFQ-T-2");
    expect(r.data.total).toBe(0);
  });
  it("others' records look like they do not exist (404, not 403)", async () => {
    expect((await one("GET", "rfqs", mine, ck.assigned)).status).toBe(200);
    expect((await one("GET", "rfqs", theirs, ck.assigned)).status).toBe(404);
    expect((await one("GET", "rfqs", unassigned, ck.assigned)).status).toBe(404);
    expect((await one("PATCH", "rfqs", theirs, ck.assigned, { status: "contacted" })).status).toBe(404);
    expect((await one("DELETE", "rfqs", theirs, ck.sa)).status).toBe(200); // a Super Admin is unrestricted
  });
  it("an assigned-scope employee cannot widen their own scope by editing", async () => {
    expect((await one("PATCH", "rfqs", mine, ck.assigned, { assignedToId: uid.assigner })).status).toBeGreaterThanOrEqual(400);
    expect((await db().rfq.findUniqueOrThrow({ where: { id: mine } })).assignedToId).toBe(uid.assigned);
  });
});

describe("website settings API", () => {
  const general = { siteName: "Hamsavahin", tagline: "Trade", defaultLanguage: "en", timezone: "Asia/Kolkata", maintenanceMode: false };
  const put = (section: string, cookie: string | undefined, body: unknown) => call(settingsRoute.PUT as H, { method: "PUT", url: `/api/settings/${section}`, cookie, body, params: { section } });
  const get = (section: string, cookie?: string) => call(settingsRoute.GET as H, { url: `/api/settings/${section}`, cookie, params: { section } });

  it("requires a session", async () => {
    expect((await get("general")).status).toBe(401);
    expect((await put("general", undefined, general)).status).toBe(401);
  });
  it("each section has its own permission", async () => {
    expect((await get("general", ck.sview)).status).toBe(200);
    expect((await get("seo", ck.sview)).status).toBe(403);
    expect((await get("general", ck.none)).status).toBe(403);
  });
  it("viewing is not editing", async () => {
    expect((await put("general", ck.sview, general)).status).toBe(403);
    expect((await put("general", ck.none, general)).status).toBe(403);
  });
  it("authorisation comes before validation (no field errors for the unauthorised)", async () => {
    const r = await put("general", ck.sview, { siteName: 5 });
    expect(r.status).toBe(403);
    expect(r.data.error.fields).toBeUndefined();
  });
  it("saves, validates, audits and returns the stored value", async () => {
    expect((await get("general", ck.sadmin)).data.value).toBeNull();
    const ok = await put("general", ck.sadmin, general);
    expect(ok.status).toBe(200);
    expect(ok.data.value).toEqual(general);
    expect((await get("general", ck.sadmin)).data.value).toEqual(general);
    expect(await db().activityLog.count({ where: { entityType: "Settings", entityLabel: "general settings" } })).toBe(1);
    const bad = await put("general", ck.sadmin, { ...general, siteName: "" });
    expect(bad.status).toBe(422);
    expect(bad.data.error.fields.siteName).toBeTruthy();
    expect((await put("general", ck.sadmin, { ...general, extra: "x" })).status).toBe(422); // unknown keys refused
    expect((await put("seo", ck.sadmin, { titleTemplate: "%s", defaultDescription: "d", defaultOgImage: "javascript:alert(1)", robotsIndex: true, googleSiteVerification: "" })).status).toBe(422); // unsafe link scheme
  });
  it("unknown sections are 404", async () => {
    expect((await get("secrets", ck.sa)).status).toBe(404);
    expect((await put("__proto__", ck.sa, {})).status).toBe(404);
  });
});

describe("assignee list", () => {
  it("is limited to people who can assign work and exposes only id + name", async () => {
    expect((await call(assignees.GET as H, { url: "/api/assignees" })).status).toBe(401);
    expect((await call(assignees.GET as H, { url: "/api/assignees", cookie: ck.none })).status).toBe(403);
    expect((await call(assignees.GET as H, { url: "/api/assignees", cookie: ck.view })).status).toBe(403);
    const r = await call(assignees.GET as H, { url: "/api/assignees", cookie: ck.assigner });
    expect(r.status).toBe(200);
    expect(r.data.items.length).toBeGreaterThan(3);
    expect(Object.keys(r.data.items[0]).sort()).toEqual(["id", "name"]);
    expect(JSON.stringify(r.data)).not.toMatch(/@m\.dev|passwordHash/);
  });
  it("lists only active employees", async () => {
    await makeUser("gone@m.dev", (await db().role.findFirstOrThrow({ where: { name: "Nothing" } })).id, "suspended");
    const r = await call(assignees.GET as H, { url: "/api/assignees", cookie: ck.assigner });
    expect(r.data.items.map((i: { name: string }) => i.name)).not.toContain("gone");
  });
});

describe("private resume download", () => {
  let appId = "";
  beforeAll(async () => {
    const d = db();
    const career = await d.career.create({ data: { title: "Analyst", slug: "analyst", department: "Trade", location: "Mumbai", employmentType: "full_time", experience: "2 years", descriptionHtml: "<p>d</p>", requirementsHtml: "<p>r</p>", deadline: new Date("2027-01-01"), status: "draft" } });
    const careerId = career.id;
    const file = await d.storedFile.create({ data: { storageKey: `resumes/${Date.now()}.pdf`, originalName: "cv.pdf", mimeType: "application/pdf", sizeBytes: BigInt(1000), kind: "resume", visibility: "private" } });
    appId = (await d.jobApplication.create({ data: { careerId, applicantName: "Rita Candidate", email: "rita@x.dev", phone: "1", experienceYears: 3, resumeFileId: file.id } })).id;
  });
  const dl = (cookie?: string, id = appId) => call(resume.GET as H, { url: `/api/applications/${id}/resume`, cookie, params: { id } });

  it("needs a session and the download permission", async () => {
    expect((await dl()).status).toBe(401);
    expect((await dl(ck.none)).status).toBe(403);
    expect((await dl(ck.hrnd)).status).toBe(403); // can view applications, cannot download resumes
    expect((await dl(ck.view)).status).toBe(403);
  });
  it("answers honestly when file storage is switched off, and never serves a path or the file", async () => {
    const before = await db().activityLog.count({ where: { action: "viewed_sensitive" } });
    setStorageForTests(null);
    const r = await dl(ck.hr).finally(() => setStorageForTests(undefined));
    expect(r.status).toBe(503);
    expect(r.data.error.code).toBe("storage_not_configured");
    expect(JSON.stringify(r.data)).not.toMatch(/resumes\/|\.pdf|storageKey/);
    expect(await db().activityLog.count({ where: { action: "viewed_sensitive" } })).toBe(before); // nothing was downloaded
  });
  it("404s for malformed and unknown ids", async () => {
    expect((await dl(ck.hr, "nope")).status).toBe(404);
    expect((await dl(ck.hr, UUID)).status).toBe(404);
  });
  it("the application DTO never exposes the storage key", async () => {
    const r = await one("GET", "applications", appId, ck.hr);
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.data)).not.toMatch(/storageKey|resumes\//);
  });
});
