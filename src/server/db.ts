import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

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
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, options: "-c timezone=UTC" }) });
}

export function getDb(): PrismaClient {
  return (globalForDb.__hvDb ??= create());
}

/** Test hook: drop the cached client so a new DATABASE_URL takes effect. */
export async function resetDbForTests() {
  await globalForDb.__hvDb?.$disconnect();
  globalForDb.__hvDb = undefined;
}
