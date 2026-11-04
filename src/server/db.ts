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
 * Connections this process may hold open.
 *
 * IMPORTANT — connection budget:
 *   Supabase transaction pooler (port 6543): many concurrent clients allowed — use this for all deployments.
 *   Supabase session pooler   (port 5432):  hard limit of 15 connections on the free plan — do NOT use in production.
 *
 *   On Vercel/serverless every function invocation is a separate process with its OWN pool.
 *   Old behaviour: max=10 → 2 concurrent Vercel functions × 10 = 20 connections → "EMAXCONNSESSION".
 *   Fix: pool=1 on serverless so each short-lived invocation holds at most one connection at a time.
 *
 *   Local dev (next dev) also spawns several worker processes, so keep the pool small there too.
 *   Override any of this with DATABASE_POOL_MAX (number, 1–50) in the environment.
 */
function poolMax(): number {
  const configured = Number(process.env.DATABASE_POOL_MAX);
  if (Number.isInteger(configured) && configured >= 1 && configured <= 50) return configured;
  // Vercel and AWS Lambda are serverless: each invocation is isolated — a pool of 1 is correct and safe.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return 1;
  // Local development: next dev spawns several Node processes; keep total low to avoid hitting limits.
  if (process.env.NODE_ENV === "development") return 2;
  // Always-on Node server (e.g. VPS / Docker): a small pool is fine; tune up with DATABASE_POOL_MAX if needed.
  return 5;
}

export function getDb(): PrismaClient {
  return (globalForDb.__hvDb ??= create());
}

/** Test hook: drop the cached client so a new DATABASE_URL takes effect. */
export async function resetDbForTests() {
  await globalForDb.__hvDb?.$disconnect();
  globalForDb.__hvDb = undefined;
}
