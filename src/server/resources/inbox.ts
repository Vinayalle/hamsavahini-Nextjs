import "server-only";
import { z } from "zod";
import type { ResourceConfig } from "./framework";
import { iso, num, pick } from "./shared";
import { errors } from "../errors";
import { getDb } from "../db";
import { hasPermission } from "@/lib/authz/resolve";
import { loadAccess } from "../authz/access";

/**
 * Inbound workflow modules: RFQs, contact enquiries, job applications.
 *  - PDF workflows: RFQ New -> Contacted -> Under Discussion -> Quotation Sent -> Closed; enquiries New/Contacted/Closed.
 *  - Notes are append-only; the author is ALWAYS the signed-in employee (never taken from the request).
 *  - RFQs and enquiries can be restricted to "assigned to me" (record-level scope, enforced by the framework).
 */

const notesSchema = z.array(z.object({ id: z.string().max(100).optional(), text: z.string().trim().min(1).max(2000) }).passthrough()).max(500);

const noteDto = (n: { id: string; authorName: string; text: string; createdAt: Date }) => ({ id: n.id, author: n.authorName, text: n.text, createdAt: iso(n.createdAt) });

/** New notes = those the client sent that are not already stored (matched by id). */
function newNotes(patchNotes: { id?: string; text: string }[], current: { notes: { id: string }[] }) {
  const known = new Set(current.notes.map((n) => n.id));
  return patchNotes.filter((n) => !n.id || !known.has(n.id));
}

/** The assignee must be an ACTIVE employee who can actually see these records. */
async function assertAssignable(userId: string | null | undefined, permission: string) {
  if (!userId) return;
  const loaded = await loadAccess(getDb(), userId);
  if (!loaded.accessible || !hasPermission(loaded.access, permission, "view")) {
    throw errors.invalid("That employee cannot be assigned: they are inactive or have no access to these records", { assignedToId: "That employee cannot be assigned" });
  }
}

const assignee = { select: { id: true, name: true } };

/* ───────────────────────── RFQs ───────────────────────── */
const RFQ_STATUS = ["new", "contacted", "under_discussion", "quotation_sent", "closed"] as const;

export const rfqs: ResourceConfig = {
  key: "rfqs", permission: "rfqs", entity: "RFQ", model: "rfq", scope: "assignee",
  include: { notes: { orderBy: { createdAt: "asc" } }, assignedTo: assignee },
  toDto: (r) => ({
    id: r.id, reference: r.reference, companyName: r.companyName, contactName: r.contactName, email: r.email, phone: r.phone, country: r.country, productOrCommodity: r.requirement,
    quantity: num(r.quantity), quantityUnit: r.quantityUnit, targetPrice: r.targetPrice ?? undefined, incoterm: r.incoterm, deliveryPort: r.deliveryPort, message: r.message,
    status: r.status, assignedTo: r.assignedTo?.name, assignedToId: r.assignedToId, notes: r.notes.map(noteDto), createdAt: iso(r.createdAt), updatedAt: iso(r.updatedAt),
  }),
  label: (r) => r.reference,
  search: ["reference", "companyName", "contactName", "requirement", "country"], sorts: ["createdAt", "reference", "status", "country", "updatedAt"], defaultSort: { by: "createdAt", dir: "desc" },
  filters: { status: (v) => (v === "pending" ? { status: { in: ["new", "contacted"] } } : { status: v }), assignedToId: (v) => ({ assignedToId: v }) },
  // RFQs arrive from the public site; admins work them but do not create them.
  patchSchema: z.object({ status: z.enum(RFQ_STATUS), assignedToId: z.uuid().nullable(), notes: notesSchema }).partial(),
  buildUpdate: async (p, cur, { session }) => {
    await assertAssignable(p.assignedToId, "rfqs");
    return {
      ...pick(p, { status: (v: string) => ({ status: v }), assignedToId: (v: string | null) => ({ assignedToId: v }) }),
      ...(p.notes ? { notes: { create: newNotes(p.notes, cur).map((n) => ({ text: n.text, authorId: session.user.id, authorName: session.user.name })) } } : {}),
    };
  },
  fieldActions: { status: "change_status", assignedToId: "assign", notes: "edit" },
  status: { field: "status", mode: "workflow", values: RFQ_STATUS },
};

/* ───────────────────────── Contact enquiries ───────────────────────── */
const ENQ_STATUS = ["new", "contacted", "closed", "spam"] as const;
const SOURCE: Record<string, string> = { contact_page: "Contact page", footer_form: "Footer form", product_page: "Product page" };

export const enquiries: ResourceConfig = {
  key: "enquiries", permission: "enquiries", entity: "Contact enquiry", model: "contactEnquiry", scope: "assignee",
  include: { notes: { orderBy: { createdAt: "asc" } }, assignedTo: assignee },
  toDto: (e) => ({
    id: e.id, name: e.name, email: e.email, phone: e.phone ?? undefined, company: e.company ?? undefined, subject: e.subject, message: e.message, source: SOURCE[e.source] ?? e.source,
    status: e.status, assignedTo: e.assignedTo?.name, assignedToId: e.assignedToId, notes: e.notes.map(noteDto), createdAt: iso(e.createdAt), updatedAt: iso(e.updatedAt),
  }),
  label: (e) => `${e.name} - ${e.subject}`,
  search: ["name", "email", "subject", "message", "company"], sorts: ["createdAt", "name", "status", "updatedAt"], defaultSort: { by: "createdAt", dir: "desc" },
  filters: {
    status: (v) => (v === "open" ? { status: { in: ["new", "contacted"] } } : { status: v }),
    source: (v) => { const key = Object.entries(SOURCE).find(([, label]) => label === v)?.[0]; return key ? { source: key } : undefined; },
    assignedToId: (v) => ({ assignedToId: v }),
  },
  patchSchema: z.object({ status: z.enum(ENQ_STATUS), assignedToId: z.uuid().nullable(), notes: notesSchema }).partial(),
  buildUpdate: async (p, cur, { session }) => {
    await assertAssignable(p.assignedToId, "enquiries");
    return {
      ...pick(p, { status: (v: string) => ({ status: v }), assignedToId: (v: string | null) => ({ assignedToId: v }) }),
      ...(p.notes ? { notes: { create: newNotes(p.notes, cur).map((n) => ({ text: n.text, authorId: session.user.id, authorName: session.user.name })) } } : {}),
    };
  },
  fieldActions: { status: "change_status", assignedToId: "assign", notes: "edit" },
  status: { field: "status", mode: "workflow", values: ENQ_STATUS },
};

/* ───────────────────────── Job applications (personal data) ───────────────────────── */
const APP_STATUS = ["new", "screening", "interview", "offer", "hired", "rejected"] as const;

export const applications: ResourceConfig = {
  key: "applications", permission: "job_applications", entity: "Job application", model: "jobApplication",
  include: { notes: { orderBy: { createdAt: "asc" } }, resumeFile: { select: { originalName: true, sizeBytes: true } } },
  toDto: (a) => ({
    id: a.id, careerId: a.careerId, applicantName: a.applicantName, email: a.email, phone: a.phone, currentCompany: a.currentCompany ?? undefined, experienceYears: a.experienceYears,
    coverNote: a.coverNote, resumeFileName: a.resumeFile?.originalName ?? "", resumeSizeBytes: a.resumeFile ? Number(a.resumeFile.sizeBytes) : 0,
    status: a.status, notes: a.notes.map(noteDto), createdAt: iso(a.createdAt), updatedAt: iso(a.updatedAt),
  }),
  label: (a) => a.applicantName,
  search: ["applicantName", "email", "currentCompany"], sorts: ["createdAt", "applicantName", "status", "experienceYears", "updatedAt"], defaultSort: { by: "createdAt", dir: "desc" },
  filters: { status: (v) => (v === "open" ? { status: { notIn: ["hired", "rejected"] } } : { status: v }), careerId: (v) => ({ careerId: v }) },
  patchSchema: z.object({ status: z.enum(APP_STATUS), notes: notesSchema }).partial(),
  buildUpdate: (p, cur, { session }) => ({
    ...pick(p, { status: (v: string) => ({ status: v }) }),
    ...(p.notes ? { notes: { create: newNotes(p.notes, cur).map((n) => ({ text: n.text, authorId: session.user.id, authorName: session.user.name })) } } : {}),
  }),
  fieldActions: { status: "change_status", notes: "edit" },
  status: { field: "status", mode: "workflow", values: APP_STATUS },
};
