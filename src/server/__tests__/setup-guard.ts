/**
 * Safety net: these tests delete rows. Refuse to run unless the runner (scripts/test.mjs) provisioned the
 * throw-away database. This makes it impossible to point the tests at a development or production database.
 */
const url = process.env.DATABASE_URL ?? "";
let dbName = "";
try {
  dbName = new URL(url).pathname.replace(/^\//, "");
} catch {
  /* empty or malformed */
}
if (process.env.HV_TEST_DB !== "1" || dbName !== "hv_test") {
  throw new Error(
    "Refusing to run: the tests wipe data and may only run against the throw-away database created by `npm test` (scripts/test.mjs).",
  );
}
