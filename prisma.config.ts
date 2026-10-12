import "dotenv/config";
import { defineConfig } from "prisma/config";

// The connection string is read from the environment (see .env.example). Nothing is hardcoded here.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
