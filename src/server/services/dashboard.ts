import "server-only";
import { z } from "zod";
import { QUICK_ACTION_BY_KEY, QUICK_ACTIONS, WIDGETS, WIDGET_BY_KEY } from "@/lib/authz/catalog";
import { getDb } from "../db";
import { recordActivity } from "../audit";
import type { AuthSession } from "../auth";
import { errors } from "../errors";
import { authorize, scopeOf } from "../rbac";
import { resolveDashboard } from "./users";

/**
 * Dashboard data is computed ONLY for widgets the signed-in user is entitled to. A widget the user lacks the
 * permission for is never queried, so its numbers cannot leak even if a saved layout lists it.
 * Record-scoped permissions (assigned-only) are honoured in the counts.
 */
type Metric = (s: AuthSession) => Promise<{ value: number } | { items: unknown[] }>;

const db = () => getDb();
const assignedOnly = (s: AuthSession, resource: string) => (scopeOf(s, resource, "view") === "assigned" ? { assignedToId: s.user.id } : {});

const METRICS: Record<string, Metric> = {
  total_products: async () => ({ value: await db().product.count() }),
  published_products: async () => ({ value: await db().product.count({ where: { status: "published" } }) }),
  draft_products: async () => ({ value: await db().product.count({ where: { status: "draft" } }) }),
  pending_reviews: async () => ({ value: await db().product.count({ where: { status: "draft" } }) }),
  active_commodities: async () => ({ value: await db().commodity.count({ where: { status: "published" } }) }),
  active_opportunities: async () => ({ value: await db().tradeOpportunity.count({ where: { status: { in: ["available", "limited_availability", "under_negotiation", "requirement_open"] } } }) }),
  new_rfqs: async (s) => ({ value: await db().rfq.count({ where: { status: "new", ...assignedOnly(s, "rfqs") } }) }),
  assigned_rfqs: async (s) => ({ value: await db().rfq.count({ where: { assignedToId: s.user.id } }) }),
  new_enquiries: async (s) => ({ value: await db().contactEnquiry.count({ where: { status: "new", ...assignedOnly(s, "enquiries") } }) }),
  assigned_enquiries: async (s) => ({ value: await db().contactEnquiry.count({ where: { assignedToId: s.user.id } }) }),
  open_applications: async () => ({ value: await db().jobApplication.count({ where: { status: { notIn: ["hired", "rejected"] } } }) }),
  published_insights: async () => ({ value: await db().post.count({ where: { status: "published" } }) }),
  global_locations: async () => ({ value: await db().location.count({ where: { active: true } }) }),
  recent_activity: async () => ({
    items: (await db().activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, actorName: true, action: true, entityType: true, entityLabel: true, createdAt: true } }))
      .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
  }),
};

export async function getOwnDashboard(session: AuthSession) {
  const resolved = await resolveDashboard(session.user.id, session.access.grants);
  const widgets = [];
  for (const pref of resolved.widgets) {
    if (!pref.enabled) continue;
    const def = WIDGET_BY_KEY.get(pref.key);
    const metric = METRICS[pref.key];
    // Defence in depth: resolveDashboard already filtered, but never trust a single layer with data access.
    if (!def || !metric || !session.access.grants.has(def.requires)) continue;
    widgets.push({ key: def.key, label: def.label, kind: def.kind, href: def.href, ...(await metric(session)) });
  }
  const quickActions = resolved.quickActions
    .map((k) => QUICK_ACTION_BY_KEY.get(k))
    .filter((q): q is NonNullable<typeof q> => !!q && session.access.grants.has(q.requires))
    .map((q) => ({ key: q.key, label: q.label, href: q.href }));
  return { widgets, quickActions };
}

/* ───────────────────────── default dashboard (applies when an employee has no saved layout) ───────────────────────── */

export const defaultDashboardInput = z.object({ widgets: z.array(z.string()).max(50), quickActions: z.array(z.string()).max(20) });

export async function getDefaultDashboard(session: AuthSession) {
  authorize(session, "user_dashboards", "view");
  const row = await getDb().siteSetting.findUnique({ where: { key: "dashboard_default" } });
  const v = (row?.value ?? null) as { widgets?: string[]; quickActions?: string[] } | null;
  return {
    widgets: v?.widgets ?? WIDGETS.map((w) => w.key),
    quickActions: v?.quickActions ?? QUICK_ACTIONS.map((q) => q.key),
    catalogue: { widgets: WIDGETS.map((w) => ({ key: w.key, label: w.label })), quickActions: QUICK_ACTIONS.map((q) => ({ key: q.key, label: q.label })) },
  };
}

export async function setDefaultDashboard(session: AuthSession, input: z.infer<typeof defaultDashboardInput>) {
  authorize(session, "user_dashboards", "edit");
  if (!session.access.isSuperAdmin) throw errors.delegation("Only a Super Admin can change the default dashboard.");
  for (const k of input.widgets) if (!WIDGET_BY_KEY.has(k)) throw errors.invalid(`Unknown widget ${k}`, { widgets: `Unknown widget ${k}` });
  for (const k of input.quickActions) if (!QUICK_ACTION_BY_KEY.has(k)) throw errors.invalid(`Unknown quick action ${k}`, { quickActions: `Unknown quick action ${k}` });
  await getDb().$transaction(async (tx) => {
    await tx.siteSetting.upsert({ where: { key: "dashboard_default" }, update: { value: input, updatedById: session.user.id }, create: { key: "dashboard_default", value: input, updatedById: session.user.id } });
    await recordActivity(tx, { session, action: "updated", entityType: "Dashboard configuration", entityLabel: "Default dashboard", ip: null });
  });
  return getDefaultDashboard(session);
}
