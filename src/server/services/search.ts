import "server-only";
import { getDb } from "../db";
import type { AuthSession } from "../auth";
import { can, scopeOf } from "../rbac";

/**
 * Light-weight helpers for the admin shell. Both honour the employee's permissions AND record-level scope, and never return
 * personal details beyond what the matching list page would show.
 */
const db = () => getDb();
const assignedOnly = (s: AuthSession, resource: string) => (scopeOf(s, resource, "view") === "assigned" ? { assignedToId: s.user.id } : {});

/** Counts for the notification bell: only the modules the employee may view; `null` = not visible to them. */
export async function attentionCounts(s: AuthSession) {
  const [rfqs, enquiries, applications] = await Promise.all([
    can(s, "rfqs", "view") ? db().rfq.count({ where: { status: "new", ...assignedOnly(s, "rfqs") } }) : null,
    can(s, "enquiries", "view") ? db().contactEnquiry.count({ where: { status: "new", ...assignedOnly(s, "enquiries") } }) : null,
    can(s, "job_applications", "view") ? db().jobApplication.count({ where: { status: "new" } }) : null,
  ]);
  return { rfqs, enquiries, applications };
}

export interface SearchHit {
  label: string;
  hint: string;
  href: string;
}

const contains = (v: string) => ({ contains: v, mode: "insensitive" as const });

/** Top matches across the modules the employee can view (5 per module). */
export async function globalSearch(s: AuthSession, term: string): Promise<SearchHit[]> {
  const q = term.trim().slice(0, 80);
  if (q.length < 2) return [];
  const take = 5;
  const jobs: Promise<SearchHit[]>[] = [];
  if (can(s, "products", "view")) {
    jobs.push(db().product.findMany({ where: { OR: [{ name: contains(q) }, { code: contains(q) }] }, take, select: { id: true, name: true, code: true } })
      .then((r) => r.map((p) => ({ label: p.name, hint: `Product · ${p.code}`, href: `/admin/products/${p.id}` }))));
  }
  if (can(s, "posts", "view")) {
    jobs.push(db().post.findMany({ where: { title: contains(q) }, take, select: { id: true, title: true } }).then((r) => r.map((p) => ({ label: p.title, hint: "Post", href: `/admin/posts/${p.id}` }))));
  }
  if (can(s, "projects", "view")) {
    jobs.push(db().project.findMany({ where: { OR: [{ title: contains(q) }, { client: contains(q) }] }, take, select: { id: true, title: true } }).then((r) => r.map((p) => ({ label: p.title, hint: "Project", href: `/admin/projects/${p.id}` }))));
  }
  if (can(s, "careers", "view")) {
    jobs.push(db().career.findMany({ where: { title: contains(q) }, take, select: { id: true, title: true } }).then((r) => r.map((c) => ({ label: c.title, hint: "Career", href: `/admin/careers/${c.id}` }))));
  }
  if (can(s, "rfqs", "view")) {
    jobs.push(db().rfq.findMany({ where: { AND: [assignedOnly(s, "rfqs"), { OR: [{ reference: contains(q) }, { companyName: contains(q) }] }] }, take, select: { reference: true, companyName: true } })
      .then((r) => r.map((x) => ({ label: `${x.reference} · ${x.companyName}`, hint: "RFQ", href: `/admin/rfqs?search=${encodeURIComponent(x.reference)}` }))));
  }
  if (can(s, "enquiries", "view")) {
    jobs.push(db().contactEnquiry.findMany({ where: { AND: [assignedOnly(s, "enquiries"), { OR: [{ name: contains(q) }, { subject: contains(q) }] }] }, take, select: { name: true, subject: true } })
      .then((r) => r.map((x) => ({ label: `${x.name} – ${x.subject}`, hint: "Enquiry", href: `/admin/enquiries?search=${encodeURIComponent(x.name)}` }))));
  }
  return (await Promise.all(jobs)).flat();
}
