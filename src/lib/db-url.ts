/**
 * Turns DATABASE_URL into the options the `pg` driver needs, understanding the usual `sslmode` values the way PostgreSQL's own tools
 * (libpq, and the Prisma migration tool) do. No server-only imports, so the seed script can use it too.
 *
 * The `pg` driver treats `sslmode=require` as the strict `verify-full` (it also checks the server certificate against public
 * authorities). Hosted poolers such as Supabase's use their own certificate authority, so that check fails with
 * "self-signed certificate in certificate chain". With libpq, `require` means: encrypt the connection, do not verify the certificate.
 * That is what this does for `require`, `prefer`, `allow` and `no-verify`.
 *
 *   sslmode=disable                      no encryption
 *   sslmode=require | prefer | allow | no-verify   encrypted, certificate not verified (libpq meaning)
 *   sslmode=verify-ca | verify-full      encrypted and verified; give the server's CA with sslrootcert (unchanged behaviour)
 *   no sslmode                           the driver's default (unchanged)
 */
export interface PgConnection {
  connectionString: string;
  ssl?: false | { rejectUnauthorized: false };
}

const ENCRYPT_ONLY = new Set(["require", "prefer", "allow", "no-verify"]);

export function pgConnection(databaseUrl: string): PgConnection {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return { connectionString: databaseUrl }; // let the driver report a malformed URL
  }
  const mode = url.searchParams.get("sslmode")?.toLowerCase();
  if (!mode) return { connectionString: databaseUrl };
  if (mode === "disable") {
    url.searchParams.delete("sslmode");
    return { connectionString: url.toString(), ssl: false };
  }
  if (ENCRYPT_ONLY.has(mode)) {
    url.searchParams.delete("sslmode");
    return { connectionString: url.toString(), ssl: { rejectUnauthorized: false } };
  }
  return { connectionString: databaseUrl }; // verify-ca / verify-full: the driver's strict behaviour is what was asked for
}
