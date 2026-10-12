import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { ActivityAction } from "@/generated/prisma/enums";
import type { AuthSession } from "./auth";

type Db = PrismaClient | Prisma.TransactionClient;

/** Client address for audit/limits. X-Forwarded-For is spoofable, so it is only read behind a trusted proxy (AUTH_TRUST_PROXY=true). */
export function clientIp(request: Request): string | null {
  const trust = process.env.AUTH_TRUST_PROXY === "true" || process.env.AUTH_TRUST_PROXY === "1";
  if (!trust) return null;
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",").pop()!.trim() : request.headers.get("x-real-ip")) || null;
}

/**
 * Append an audit row. Pass the transaction client so the audit entry commits atomically with the change.
 * Never include secrets, password hashes or full resume contents in `detail`.
 */
export async function recordActivity(
  db: Db,
  entry: {
    session?: AuthSession | null;
    actorName?: string;
    action: ActivityAction;
    entityType: string;
    entityId?: string | null;
    entityLabel: string;
    detail?: string | null;
    ip?: string | null;
  },
) {
  await db.activityLog.create({
    data: {
      actorId: entry.session?.user.id ?? null,
      actorName: entry.session?.user.name ?? entry.actorName ?? "System",
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      entityLabel: entry.entityLabel,
      detail: entry.detail ?? null,
      ip: entry.ip ?? null,
    },
  });
}
