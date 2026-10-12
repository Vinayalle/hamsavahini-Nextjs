import "server-only";
import { z } from "zod";
import type { ResourceConfig } from "./framework";
import { iso, patchOf, pick, text } from "./shared";
import { errors } from "../errors";

/* ───────────────────────── Email templates ───────────────────────── */
const extractVariables = (...texts: string[]) => Array.from(new Set(texts.flatMap((t) => Array.from(t.matchAll(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g)).map((m) => m[1]))));
const tplBase = z.object({
  key: z.string().trim().min(3, "System key is required").max(60).regex(/^[a-z][a-z0-9_]*$/, "Lowercase letters, numbers and underscores"),
  name: text(2, 100, "Name"), subject: text(2, 200, "Subject"), body: text(20, 10_000, "Body"), active: z.boolean().default(true),
});

export const emailTemplates: ResourceConfig = {
  key: "email-templates", permission: "email_templates", entity: "Email template", model: "emailTemplate",
  toDto: (t) => ({ id: t.id, key: t.key, name: t.name, subject: t.subject, body: t.body, variables: t.variables, active: t.active, createdAt: iso(t.createdAt), updatedAt: iso(t.updatedAt) }),
  label: (t) => t.name,
  search: ["name", "key", "subject"], sorts: ["name", "key", "updatedAt", "active"], defaultSort: { by: "name", dir: "asc" },
  filters: { active: (v) => ({ active: v === "true" }) },
  createSchema: tplBase, patchSchema: patchOf(tplBase),
  buildCreate: (i) => ({ key: i.key, name: i.name, subject: i.subject, body: i.body, active: i.active, variables: extractVariables(i.subject, i.body) }),
  buildUpdate: (p, cur) => ({
    ...pick(p, { key: (v: string) => ({ key: v }), name: (v: string) => ({ name: v }), subject: (v: string) => ({ subject: v }), body: (v: string) => ({ body: v }), active: (v: boolean) => ({ active: v }) }),
    // Variables are always derived from the final text, never trusted from the client.
    ...(p.subject !== undefined || p.body !== undefined ? { variables: extractVariables(p.subject ?? cur.subject, p.body ?? cur.body) } : {}),
  }),
  unique: [{ fields: ["key"], message: "Another template uses this key", errorField: "key" }],
};

/* ───────────────────────── Notification history ───────────────────────── */
export const notifications: ResourceConfig = {
  key: "notifications", permission: "notification_history", entity: "Notification", model: "notificationLog", noDelete: true,
  editAction: "change_status",
  toDto: (n) => ({ id: n.id, templateKey: n.templateKey, recipient: n.recipient, subject: n.subject, status: n.status, error: n.error ?? undefined, createdAt: iso(n.createdAt), updatedAt: iso(n.createdAt) }),
  label: (n) => n.subject,
  search: ["recipient", "subject", "templateKey"], sorts: ["createdAt", "status", "recipient"], defaultSort: { by: "createdAt", dir: "desc" },
  filters: { status: (v) => ({ status: v }) },
  // The only change allowed: put a FAILED message back in the queue. Nothing is sent from here (no mail provider).
  patchSchema: z.object({ status: z.literal("queued") }),
  buildUpdate: (_p, cur) => {
    if (cur.status !== "failed") throw errors.conflict("Only failed notifications can be retried");
    return { status: "queued", error: null, attempts: cur.attempts + 1 };
  },
  fieldActions: { status: "change_status" },
};

/* ───────────────────────── Activity logs (append-only, read-only here) ───────────────────────── */
export const activityLogs: ResourceConfig = {
  key: "activity-logs", permission: "activity_logs", entity: "Activity log", model: "activityLog", readOnly: true,
  toDto: (a) => ({ id: a.id, actor: a.actorName, action: a.action, entityType: a.entityType, entityLabel: a.entityLabel, detail: a.detail ?? undefined, createdAt: iso(a.createdAt), updatedAt: iso(a.createdAt) }),
  label: (a) => a.entityLabel,
  search: ["actorName", "entityType", "entityLabel", "detail"], sorts: ["createdAt", "actorName", "action"], defaultSort: { by: "createdAt", dir: "desc" },
  filters: { action: (v) => ({ action: v }), actor: (v) => ({ actorName: v }) },
};
