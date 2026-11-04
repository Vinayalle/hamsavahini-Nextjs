import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { pgConnection } from "../src/lib/db-url";

async function main() {
  const url = process.env.DATABASE_URL;
  console.log("Testing with options: '-c timezone=UTC'");
  const db = new PrismaClient({
    adapter: new PrismaPg({
      ...pgConnection(url!),
      options: "-c timezone=UTC",
      max: 4,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000,
    }),
  });

  try {
    const locs = await db.location.findMany();
    console.log("SUCCESS! Found locations:", locs.length);
  } catch (err) {
    console.error("FAILED! Error was:", err);
  } finally {
    await db.$disconnect();
  }
}

main();

