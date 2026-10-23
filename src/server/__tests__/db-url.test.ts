import { describe, expect, it } from "vitest";
import { pgConnection } from "@/lib/db-url";

const base = "postgresql://user:p%40ss@host.example:5432/postgres";

describe("pgConnection: sslmode in DATABASE_URL", () => {
  it("leaves a URL without sslmode alone", () => {
    expect(pgConnection(base)).toEqual({ connectionString: base });
  });
  it.each(["require", "prefer", "allow", "no-verify", "REQUIRE"])("sslmode=%s encrypts without verifying the certificate (libpq meaning) and removes the parameter", (mode) => {
    const c = pgConnection(`${base}?sslmode=${mode}&connect_timeout=30`);
    expect(c.ssl).toEqual({ rejectUnauthorized: false });
    expect(c.connectionString).toBe(`${base}?connect_timeout=30`);
    expect(c.connectionString).not.toMatch(/sslmode/);
  });
  it("keeps the password's special characters intact", () => {
    expect(new URL(pgConnection(`${base}?sslmode=require`).connectionString).password).toBe("p%40ss");
  });
  it("sslmode=disable turns encryption off", () => {
    expect(pgConnection(`${base}?sslmode=disable`)).toEqual({ connectionString: base, ssl: false });
  });
  it("verify-ca and verify-full keep the driver's strict behaviour untouched", () => {
    for (const mode of ["verify-ca", "verify-full"]) {
      const u = `${base}?sslmode=${mode}`;
      expect(pgConnection(u)).toEqual({ connectionString: u });
    }
  });
  it("does not throw on a malformed URL (the driver reports it)", () => {
    expect(pgConnection("not a url")).toEqual({ connectionString: "not a url" });
  });
});
