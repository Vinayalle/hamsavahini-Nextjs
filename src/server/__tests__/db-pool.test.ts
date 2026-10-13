import { afterAll, describe, expect, it } from "vitest";
import pg from "pg";
import { getDb, resetDbForTests } from "@/server/db";

/** The app must never hold more database connections than its pool allows, whatever the request load (hosted poolers have tiny limits). */
describe("database connection pool", () => {
  const saved = process.env.DATABASE_POOL_MAX;
  afterAll(async () => {
    if (saved === undefined) delete process.env.DATABASE_POOL_MAX;
    else process.env.DATABASE_POOL_MAX = saved;
    await resetDbForTests();
  });

  const peak = async (max: string) => {
    process.env.DATABASE_POOL_MAX = max;
    await resetDbForTests();
    const watcher = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await watcher.connect();
    const db = getDb();
    // Prisma queries are lazy: Promise.all subscribes to every one, which is what actually starts them.
    const running = Promise.all(Array.from({ length: 25 }, () => db.$queryRaw`SELECT 1 AS ok FROM pg_sleep(0.3)`));
    let highest = 0;
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 120));
      const { rows } = await watcher.query(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND query LIKE '%pg_sleep%'`);
      highest = Math.max(highest, rows[0].n);
    }
    await running;
    await watcher.end();
    return highest;
  };

  it("25 simultaneous queries use at most DATABASE_POOL_MAX connections", async () => {
    const withThree = await peak("3");
    expect(withThree).toBeGreaterThanOrEqual(1);
    expect(withThree).toBeLessThanOrEqual(3);
    const withTwo = await peak("2");
    expect(withTwo).toBeLessThanOrEqual(2);
  });

  it("an invalid setting falls back to a safe default instead of breaking", async () => {
    process.env.DATABASE_POOL_MAX = "banana";
    await resetDbForTests();
    await expect(getDb().$queryRaw`SELECT 1 AS ok`).resolves.toBeTruthy();
  });
});
