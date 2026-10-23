import "server-only";
import { z } from "zod";
import type { ResourceConfig } from "./framework";
import { iso } from "./shared";
import { errors } from "../errors";

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
