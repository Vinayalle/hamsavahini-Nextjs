import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError, errors } from "../errors";
import { getDb } from "../db";
import { enforce, sourceKey } from "../ratelimit";
import { parseBody } from "../http";
import { newStorageKey, validateUpload } from "../files";
import { getStorage } from "../storage";
import { sendFormConfirmation } from "../notify";
import { applicationReceivedEmail, enquiryReceivedEmail, rfqReceivedEmail } from "../mail-templates";
import { assertBodySize } from "./library";

/**
 * PUBLIC FORMS: contact enquiry, request for quotation (RFQ) and job application.
 *
 * Anyone on the internet can call these, so each one is defensive:
 *  - same-origin check (done by `route()`), body size caps, strict zod validation with length limits;
 *  - a hidden "website" field that real people never fill: bots that do are answered with a normal-looking success and nothing is stored;
 *  - at most a few links per message (the classic spam signature);
 *  - rate limits per source address AND per email address (database-backed, shared by every server instance);
 *  - consent is required and recorded;
 *  - answers never contain internal ids, and validation errors name only the field, never anything about stored data;
 *  - resumes are validated by content, size-capped, stored privately under random keys, and removed again if the database write fails.
 */
const MAX_JSON_BYTES = 64 * 1024;
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

/** Removes control characters and collapses runs of blank lines; the text is stored and later shown as plain text. */
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\n{4,}/g, "\n\n\n").trim();
const text = (min: number, max: number, label: string) =>
  z.string({ error: `${label} is required` }).transform(clean).pipe(z.string().min(min, min ? `${label} is required` : undefined).max(max, `${label} is too long`));
const optionalText = (max: number) => z.string().transform(clean).pipe(z.string().max(max, "Too long")).optional().transform((v) => (v ? v : null));
const email = z.string({ error: "Email is required" }).trim().toLowerCase().pipe(z.string().email("Enter a valid email address").max(160));
const phone = (required: boolean) =>
  z.string().trim().transform((v) => v.replace(/\s+/g, " ")).pipe(z.string().max(30).regex(/^[0-9+()\-.\s]{0,30}$/, "Use digits, spaces and + ( ) - only").refine((v) => !required || v.replace(/\D/g, "").length >= 6, "Enter a valid phone number"));
const consent = z.literal(true, { error: "Please accept the privacy notice to continue" });
/** Honeypot: hidden from people (and screen readers), irresistible to form-filling bots. */
const honeypot = z.string().max(200).optional();
const noLinkSpam = (message: string) => (message.match(/https?:\/\/|www\./gi) ?? []).length <= 3;

const enquirySchema = z.object({
  name: text(2, 100, "Name"), email, phone: phone(false).optional().transform((v) => (v ? v : null)), company: optionalText(120),
  subject: text(3, 150, "Subject"), message: text(10, 4000, "Message").refine(noLinkSpam, "Please remove some of the links from your message"),
  source: z.enum(["contact_page", "footer_form", "product_page"]).default("contact_page"), consent, website: honeypot,
});

export const RFQ_UNITS = ["MT", "DMT", "kg", "pcs"] as const;
export const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CIP", "DAP", "DDP"] as const;
const rfqSchema = z.object({
  companyName: text(2, 150, "Company name"), contactName: text(2, 100, "Your name"), email, phone: phone(true), country: text(2, 80, "Country"),
  requirement: text(3, 300, "Mineral / product"), quantity: z.coerce.number({ error: "Enter a quantity" }).positive("Enter a quantity above zero").max(1_000_000_000, "Quantity is too large"),
  quantityUnit: z.enum(RFQ_UNITS, { error: "Choose a unit" }), targetPrice: optionalText(60), incoterm: z.enum(INCOTERMS, { error: "Choose an incoterm" }),
  deliveryPort: text(2, 120, "Delivery port"), message: z.string().transform(clean).pipe(z.string().max(4000).refine(noLinkSpam, "Please remove some of the links from your message")).default(""),
  consent, website: honeypot,
});

const applicationFields = z.object({
  careerSlug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Unknown position"),
  applicantName: text(2, 100, "Your name"), email, phone: phone(true), currentCompany: optionalText(120),
  experienceYears: z.coerce.number({ error: "Enter your years of experience" }).int("Use whole years").min(0).max(60),
  coverNote: z.string().transform(clean).pipe(z.string().max(4000).refine(noLinkSpam, "Please remove some of the links from your note")).default(""), consent, website: honeypot,
});

/** Limits: generous per source (every visitor shares one bucket unless a trusted proxy supplies real addresses), strict per email. */
async function throttle(scope: string, request: Request, address: string) {
  const emailKey = createHash("sha256").update(address).digest("hex").slice(0, 32);
  await enforce(`public:${scope}:source:${sourceKey(request)}`, { max: 120, windowSeconds: 3600 });
  await enforce(`public:${scope}:email:${emailKey}`, { max: scope === "application" ? 5 : 6, windowSeconds: 3600 });
}

const OK = { ok: true } as const;
const isBot = (v: { website?: string }) => !!v.website;

/* ───────────── enquiry ───────────── */
export async function createEnquiry(request: Request) {
  assertBodySize(request, MAX_JSON_BYTES);
  const v = await parseBody(request, enquirySchema);
  if (isBot(v)) return OK; // pretend success, store nothing
  await throttle("enquiry", request, v.email);
  await getDb().contactEnquiry.create({ data: { name: v.name, email: v.email, phone: v.phone, company: v.company, subject: v.subject, message: v.message, source: v.source, consentAt: new Date() } });
  await sendFormConfirmation("enquiry_received", v.email, enquiryReceivedEmail(v.name, v.subject));
  return OK;
}

/* ───────────── RFQ ───────────── */
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newReference = () => `RFQ-${new Date().getUTCFullYear()}-${Array.from(randomBytes(6), (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("")}`;

export async function createRfq(request: Request) {
  assertBodySize(request, MAX_JSON_BYTES);
  const v = await parseBody(request, rfqSchema);
  if (isBot(v)) return { ...OK, reference: "RFQ-PENDING" };
  await throttle("rfq", request, v.email);
  for (let attempt = 0; attempt < 4; attempt++) {
    const reference = newReference();
    try {
      await getDb().rfq.create({
        data: { reference, companyName: v.companyName, contactName: v.contactName, email: v.email, phone: v.phone, country: v.country, requirement: v.requirement, quantity: v.quantity, quantityUnit: v.quantityUnit, targetPrice: v.targetPrice, incoterm: v.incoterm, deliveryPort: v.deliveryPort, message: v.message, consentAt: new Date() },
      });
      await sendFormConfirmation("rfq_received", v.email, rfqReceivedEmail(v.contactName, { reference, requirement: v.requirement, quantity: `${v.quantity.toLocaleString("en-US")} ${v.quantityUnit}`, incoterm: v.incoterm, deliveryPort: v.deliveryPort }));
      return { ...OK, reference };
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // only a reference collision is retried
    }
  }
  throw new ApiError(503, "try_again", "We could not register your request just now. Please try again.");
}

/* ───────────── job application (multipart: fields + optional resume) ───────────── */
export async function createApplication(request: Request) {
  assertBodySize(request, MAX_RESUME_BYTES + 256 * 1024);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw errors.invalid("The application could not be read");
  }
  const fields: Record<string, unknown> = {};
  for (const key of ["careerSlug", "applicantName", "email", "phone", "currentCompany", "experienceYears", "coverNote", "website"]) {
    const value = form.get(key);
    if (typeof value === "string") fields[key] = value;
  }
  fields.consent = form.get("consent") === "true" || form.get("consent") === "on";
  const parsed = applicationFields.safeParse(fields);
  if (!parsed.success) {
    const out: Record<string, string> = {};
    for (const i of parsed.error.issues) out[i.path.join(".") || "_"] ??= i.message;
    throw errors.invalid("Please check the highlighted fields", out);
  }
  const v = parsed.data;
  if (isBot(v)) return OK;
  await throttle("application", request, v.email);

  const db = getDb();
  const career = await db.career.findFirst({ where: { slug: v.careerSlug, status: "open", deadline: { gte: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())) } }, select: { id: true, title: true } });
  if (!career) throw errors.notFound("Position");
  const already = await db.jobApplication.count({ where: { careerId: career.id, email: v.email, createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } } });
  if (already > 0) throw new ApiError(409, "already_applied", "We already have your application for this position.");

  const file = form.get("resume");
  const data = { careerId: career.id, applicantName: v.applicantName, email: v.email, phone: v.phone, currentCompany: v.currentCompany, experienceYears: v.experienceYears, coverNote: v.coverNote, consentAt: new Date() };
  if (!(file instanceof File) || file.size === 0) {
    await db.jobApplication.create({ data });
    await sendFormConfirmation("application_received", v.email, applicationReceivedEmail(v.applicantName, career.title));
    return OK;
  }
  if (file.size > MAX_RESUME_BYTES) throw new ApiError(413, "file_too_large", "The resume is too large (maximum 5 MB).");
  const storage = getStorage();
  if (!storage) throw new ApiError(503, "resume_unavailable", "Resume upload is not available right now. You can apply without a file and send it later.");
  const up = await validateUpload(file, ["document"]);
  const key = newStorageKey("documents", up.ext);
  try {
    await storage.put(key, up.bytes, { contentType: up.mime });
  } catch (e) {
    console.error("[api] resume upload failed", e instanceof Error ? e.name : "unknown");
    throw new ApiError(502, "storage_upload_failed", "The resume could not be stored. Nothing was saved. Please try again.");
  }
  try {
    await db.$transaction(async (tx) => {
      const stored = await tx.storedFile.create({ data: { storageKey: key, originalName: up.originalName, mimeType: up.mime, sizeBytes: BigInt(up.size), sha256: up.sha256, kind: "resume", visibility: "private", scanStatus: "pending" } });
      await tx.jobApplication.create({ data: { ...data, resumeFileId: stored.id } });
    });
  } catch (e) {
    await storage.delete(key).catch(() => undefined); // no orphan object when the record could not be written
    throw e;
  }
  await sendFormConfirmation("application_received", v.email, applicationReceivedEmail(v.applicantName, career.title));
  return OK;
}
