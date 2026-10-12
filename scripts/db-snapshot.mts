/**
 * Read-only row counts + a content checksum per table. Used to prove a migration preserved existing data:
 *   npx tsx scripts/db-snapshot.mts > before.json   (run before migrating)
 *   npx tsx scripts/db-snapshot.mts > after.json    (run after, then compare the shared tables)
 * Reads only. Prints no credentials, hashes or secrets (only counts and an MD5 over non-secret columns).
 */
import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const tables = (
  await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name <> '_prisma_migrations' ORDER BY 1`)
).rows.map((r) => r.table_name as string);

// Columns that hold secrets are excluded from the checksum.
const SECRET = new Set(["passwordHash", "tokenHash"]);
const out: Record<string, { rows: number; checksum: string }> = {};
for (const t of tables) {
  const cols = (
    await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t])
  ).rows.map((r) => r.column_name as string).filter((c) => !SECRET.has(c));
  const list = cols.map((c) => `"${c}"`).join(", ");
  const r = await client.query(`SELECT count(*)::int AS n, coalesce(md5(string_agg(row(${list})::text, '|' ORDER BY "${cols[0]}"::text)), 'empty') AS h FROM "${t}"`);
  out[t] = { rows: r.rows[0].n, checksum: r.rows[0].h };
}
console.log(JSON.stringify(out, null, 1));
await client.end();
