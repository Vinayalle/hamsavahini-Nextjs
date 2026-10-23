import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { pgConnection } from "@/lib/db-url";

/**
 * Single PrismaClient per process (survives Next.js dev hot reloads).
 * The connection string comes only from DATABASE_URL; there is no fallback and no default credential.
 */
const globalForDb = globalThis as unknown as { __hvDb?: PrismaClient };

function create(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
  // The driver adapter writes timestamps as UTC wall-clock text. If the database session runs in another time zone, PostgreSQL
  // would store the wrong instant (observed locally: 5.5 h off under Asia/Kolkata). Pinning the SESSION time zone to UTC makes
  // storage correct whatever the server default is, so expiry/rate-limit logic and any raw SQL reporting agree.
  return new PrismaClient({ adapter: new PrismaPg({ ...pgConnection(connectionString), options: "-c timezone=UTC", max: poolMax(), idleTimeoutMillis: 10_000, connectionTimeoutMillis: 15_000 }) });
}

/**
 * Connections this process may hold open. Hosted poolers allow few clients in total (Supabase's session pooler: 15 on small plans), and
 * `next dev` runs several server processes (pages, API routes, proxy), each with its own pool, so development uses a small pool.
 * Override with DATABASE_POOL_MAX.
 */
function poolMax(): number {
  const configured = Number(process.env.DATABASE_POOL_MAX);
  if (Number.isInteger(configured) && configured >= 1 && configured <= 50) return configured;
  return process.env.NODE_ENV === "development" ? 4 : 10;
}

export function getDb(): PrismaClient {
  return (globalForDb.__hvDb ??= create());
}

/** Test hook: drop the cached client so a new DATABASE_URL takes effect. */
export async function resetDbForTests() {
  await globalForDb.__hvDb?.$disconnect();
  globalForDb.__hvDb = undefined;
}
