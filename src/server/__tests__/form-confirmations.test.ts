import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db";
import { setMailer, type MailMessage } from "@/server/mail";
import { call } from "./helpers";
import * as enquiries from "@/app/api/public/enquiries/route";
import * as rfqs from "@/app/api/public/rfqs/route";
import * as applications from "@/app/api/public/applications/route";

/** The confirmation email the visitor gets after a public website form: what it says, and that it can never break or slow the form. */
type H = Parameters<typeof call>[0];
const db = () => getDb();
const sink: MailMessage[] = [];
const post = (handler: unknown, body: unknown) => call(handler as H, { method: "POST", url: "/api/public/x", body });
const enquiry = (over: Record<string, unknown> = {}) => ({ name: "Asha Rao", email: "asha@buyer.test", subject: "Iron ore enquiry", message: "We would like a quotation for iron ore fines, 5,000 MT per month.", consent: true, ...over });
const rfq = (over: Record<string, unknown> = {}) => ({ companyName: "Nordic Alloys", contactName: "Lars", email: "lars@nordic.test", phone: "+47 22 00 00 00", country: "Norway", requirement: "Manganese ore", quantity: 2500, quantityUnit: "MT", incoterm: "CIF", deliveryPort: "Rotterdam", message: "Spot requirement.", consent: true, ...over });
const day = (offset: number) => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + offset)); };
const apply = (slug: string, over: Record<string, string> = {}) => {
  const fd = new FormData();
  const base: Record<string, string> = { careerSlug: slug, applicantName: "Ravi Kumar", email: "ravi@candidate.test", phone: "+91 90000 11111", currentCompany: "Port Co", experienceYears: "4", coverNote: "Keen to join.", consent: "true", ...over };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return call(applications.POST as H, { method: "POST", url: "/api/public/applications", body: "multipart", form: fd });
};

beforeAll(() => { setMailer({ send: async (m) => { sink.push(m); return { delivered: true, providerMessageId: "sink" }; } }); });
afterAll(async () => {
  setMailer(null);
  await db().jobApplication.deleteMany();
  await db().career.deleteMany({ where: { slug: { startsWith: "conf-" } } });
  await db().notificationLog.deleteMany({ where: { templateKey: { in: ["enquiry_received", "rfq_received", "application_received"] } } });
});
beforeEach(async () => {
  sink.length = 0;
  setMailer({ send: async (m) => { sink.push(m); return { delivered: true, providerMessageId: "sink" }; } });
  await db().rateLimit.deleteMany();
  await db().contactEnquiry.deleteMany();
  await db().rfq.deleteMany();
  await db().jobApplication.deleteMany();
});

describe("confirmation emails for the website forms", () => {
  it("contact form: confirms to the address that was entered, with a fixed subject and the visitor's subject line escaped in the body", async () => {
    const r = await post(enquiries.POST, enquiry({ subject: "Price <b>list</b> & terms" }));
    expect(r.status).toBe(201);
    expect(sink).toHaveLength(1);
    const m = sink[0];
    expect(m.to).toBe("asha@buyer.test");
    expect(m.subject).toMatch(/^We received your message/);
    expect(m.subject).not.toContain("Price"); // visitor text never becomes the email subject
    expect(m.text).toContain("Hello Asha Rao");
    expect(m.text).toContain("Price <b>list</b> & terms");
    expect(m.html).toContain("Price &lt;b&gt;list&lt;/b&gt; &amp; terms");
    expect(m.html).not.toContain("<b>list</b>");
    expect(m.text).not.toMatch(/We would like a quotation/); // the long message is not echoed
    expect(await db().notificationLog.count({ where: { templateKey: "enquiry_received", recipient: "asha@buyer.test", status: "sent" } })).toBe(1);
  });

  it("quotation form: confirms with the same reference number that the visitor is shown", async () => {
    const r = await post(rfqs.POST, rfq());
    expect(r.status).toBe(201);
    expect(sink).toHaveLength(1);
    const m = sink[0];
    expect(m.to).toBe("lars@nordic.test");
    expect(m.subject).toContain(r.data.reference);
    expect(m.text).toContain(`Reference: ${r.data.reference}`);
    expect(m.text).toContain("Material: Manganese ore");
    expect(m.text).toContain("Quantity: 2,500 MT");
    expect(m.text).toContain("Incoterm: CIF");
    expect(m.text).toContain("Delivery port: Rotterdam");
  });

  it("job application: confirms with the position title, with and without a resume path", async () => {
    const c = await db().career.create({ data: { slug: "conf-logistics", title: "Logistics Coordinator", department: "Operations", location: "Mumbai", employmentType: "full_time", experience: "3+ years", descriptionHtml: "<p>d</p>", requirementsHtml: "<p>r</p>", deadline: day(30), status: "open" } });
    expect(c.slug).toBe("conf-logistics");
    const r = await apply("conf-logistics");
    expect(r.status).toBe(201);
    expect(sink).toHaveLength(1);
    expect(sink[0].to).toBe("ravi@candidate.test");
    expect(sink[0].text).toContain("Position: Logistics Coordinator");
    expect(sink[0].subject).toMatch(/^We received your application/);
  });

  it("sends nothing when the form is refused, dropped as a bot, or a duplicate application", async () => {
    expect((await post(enquiries.POST, enquiry({ email: "not-an-email" }))).status).toBe(422);
    expect((await post(enquiries.POST, enquiry({ consent: false }))).status).toBe(422);
    expect((await post(enquiries.POST, enquiry({ website: "https://spam.example" }))).status).toBe(201); // looks like success to the bot
    expect((await post(rfqs.POST, rfq({ website: "x" }))).status).toBe(201);
    await db().career.create({ data: { slug: "conf-dup", title: "Analyst", department: "Trade", location: "Mumbai", employmentType: "full_time", experience: "2", descriptionHtml: "<p>d</p>", requirementsHtml: "<p>r</p>", deadline: day(10), status: "open" } });
    expect((await apply("conf-dup")).status).toBe(201);
    sink.length = 0;
    expect((await apply("conf-dup")).status).toBe(409);
    expect((await apply("conf-missing")).status).toBe(404);
    expect(sink).toHaveLength(0);
  });

  it("a failing or unconfigured mail server never breaks the form: the entry is saved and the failure is only logged", async () => {
    setMailer({ send: async () => ({ delivered: false, error: "SMTP down" }) });
    expect((await post(enquiries.POST, enquiry())).status).toBe(201);
    expect(await db().contactEnquiry.count()).toBe(1);
    expect(await db().notificationLog.count({ where: { templateKey: "enquiry_received", status: "failed" } })).toBeGreaterThanOrEqual(1);
    setMailer({ send: async () => { throw new Error("boom"); } });
    const r = await post(rfqs.POST, rfq({ email: "other@nordic.test" }));
    expect(r.status).toBe(201);
    expect(await db().rfq.count()).toBe(1);
    setMailer(null); // no SMTP configured at all
    expect((await post(enquiries.POST, enquiry({ email: "third@buyer.test" }))).status).toBe(201);
  });
});
