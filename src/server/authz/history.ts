import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { AuthSession } from "../auth";

type Db = PrismaClient | Prisma.TransactionClient;

export type AccessChangeKind =
  | "user_created"
  | "role_assigned"
  | "role_removed"
  | "override_set"
  | "override_removed"
  | "role_permissions_changed"
  | "role_created"
  | "role_status_changed"
  | "role_deleted"
  | "status_changed"
  | "dashboard_changed"
  | "password_reset_requested";

/**
 * Append a permission-history row. Call it with the SAME transaction client as the change itself so the history
 * can never disagree with the data. `change` must never contain secrets (passwords, tokens).
 */
export async function recordAccessChange(
  db: Db,
  entry: {
    session: AuthSession | null;
    actorName?: string;
    targetType: "user" | "role";
    targetId: string;
    targetLabel: string;
    kind: AccessChangeKind;
    change: Prisma.InputJsonValue;
  },
) {
  await db.permissionChangeLog.create({
    data: {
      actorId: entry.session?.user.id ?? null,
      actorName: entry.session?.user.name ?? entry.actorName ?? "System",
      targetType: entry.targetType,
      targetId: entry.targetId,
      targetLabel: entry.targetLabel,
      kind: entry.kind,
      change: entry.change,
    },
  });
}
