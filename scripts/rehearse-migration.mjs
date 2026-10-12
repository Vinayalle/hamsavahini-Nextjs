// Clones the database named in DATABASE_URL into `hv_rehearsal` (CREATE DATABASE ... TEMPLATE). The source is only READ.
// Use it to rehearse a migration on a copy of real data first (see docs/operations.md). It replaces a previous hv_rehearsal.
//   node scripts/rehearse-migration.mjs
// Then run `prisma migrate deploy` with DATABASE_URL pointing at hv_rehearsal and compare scripts/db-snapshot.mts output.
// Refuses to run against a database that is itself named hv_rehearsal. Prints no connection details.
import "dotenv/config";
import pg from "pg";
const base = new URL(process.env.DATABASE_URL);
if (base.pathname.slice(1) === "hv_rehearsal") throw new Error("DATABASE_URL already points at hv_rehearsal; point it at the database you want to copy.");
const admin = new pg.Client({ connectionString: base.toString().replace(/\/[^/?]+(\?|$)/, "/postgres$1") });
await admin.connect();
await admin.query("DROP DATABASE IF EXISTS hv_rehearsal");
await admin.query(`CREATE DATABASE hv_rehearsal TEMPLATE ${base.pathname.slice(1)}`);
await admin.end();
console.log("rehearsal copy ready");
