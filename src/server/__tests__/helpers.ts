import { getDb } from "@/server/db";
import { hashPassword } from "@/server/security";
import { getMailerOverride, setMailer } from "@/server/mail";
import { syncPermissionCatalogue, nextEmployeeId } from "@/lib/authz/bootstrap";
import type { Scope } from "@/lib/authz/resolve";

export const ORIGIN = "http://localhost:3000";
export const PASSWORD = "Correct-Horse-Battery-9";

type Grants = Partial<Record<string, string[]>>;

export async function ensurePermissions() {
  await syncPermissionCatalogue(getDb());
}

let roleSeq = 0;
export async function makeRole(
  name: string,
  grants: Grants,
  opts: { isSystem?: boolean; status?: "active" | "inactive"; scopes?: Record<string, Scope> } | boolean = {},
) {
  const o = typeof opts === "boolean" ? { isSystem: opts } : opts;
  const db = getDb();
  const perms = await db.permission.findMany();
  const code = name === "Super Admin" ? "super_admin" : `${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${++roleSeq}`;
  const role = await db.role.create({ data: { name, code, description: `${name} role for tests`, isSystem: o.isSystem ?? code === "super_admin", status: o.status ?? "active" } });
  const data = Object.entries(grants).flatMap(([resource, actions]) =>
    (actions ?? []).map((a) => {
      const p = perms.find((x) => x.resource === resource && x.action === a);
      if (!p) throw new Error(`test setup: ${resource}:${a} is not in the catalogue`);
      return { roleId: role.id, permissionId: p.id, scope: o.scopes?.[resource] ?? ("all" as Scope) };
    }),
  );
  await db.rolePermission.createMany({ data });
  return role;
}

export async function makeUser(
  email: string,
  roleIds: string | string[],
  status: "active" | "invited" | "suspended" = "active",
  password = PASSWORD,
  extra: { name?: string; department?: string } = {},
) {
  const db = getDb();
  const ids = Array.isArray(roleIds) ? roleIds : [roleIds];
  const user = await db.adminUser.create({
    data: {
      employeeId: await nextEmployeeId(db),
      email, name: extra.name ?? email.split("@")[0], department: extra.department,
      passwordHash: await hashPassword(password), status, emailVerifiedAt: status === "active" ? new Date() : null,
      roles: { create: ids.map((roleId) => ({ roleId })) },
    },
  });
  return user;
}

/** Directly sets an individual override (bypassing the API) for test arrangement. */
export async function setOverride(userId: string, resource: string, action: string, effect: "allow" | "deny", scope: Scope = "all") {
  const db = getDb();
  const permission = await db.permission.findUniqueOrThrow({ where: { resource_action: { resource, action } } });
  await db.userPermissionOverride.upsert({
    where: { userId_permissionId: { userId, permissionId: permission.id } },
    update: { effect, scope },
    create: { userId, permissionId: permission.id, effect, scope },
  });
}

interface CallOptions {
  method?: string;
  url: string;
  body?: unknown;
  cookie?: string | null;
  origin?: string | null;
  contentType?: string | null;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  /** Multipart body (uploads). */
  form?: FormData;
}

type Handler = (request: Request, ctx?: { params: Promise<never> }) => Promise<Response>;

export async function call(handler: Handler, opts: CallOptions) {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { host: "localhost:3000" };
  if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN;
  if (opts.cookie) headers.cookie = opts.cookie;
  Object.assign(headers, opts.headers ?? {});
  const hasBody = opts.body !== undefined;
  if (hasBody && !opts.form) headers["content-type"] = opts.contentType ?? "application/json";
  const request = new Request(`http://localhost:3000${opts.url}`, {
    method,
    headers,
    body: opts.form ?? (hasBody ? (typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body)) : undefined),
  });
  const res = await handler(request, opts.params ? { params: Promise.resolve(opts.params) as Promise<never> } : undefined);
  const raw = Buffer.from(await res.arrayBuffer());
  const text = raw.toString("utf8");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, headers: res.headers, raw };
}

/** Logs in through the real login handler and returns the cookie header to replay. */
export function cookieJar(res: { headers: Headers }): Record<string, string> {
  const jar: Record<string, string> = {};
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const i = pair.indexOf("=");
    const value = decodeURIComponent(pair.slice(i + 1));
    if (!/Max-Age=0/i.test(line)) jar[pair.slice(0, i)] = value;
  }
  return jar;
}
export const cookieHeader = (jar: Record<string, string>) => Object.entries(jar).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ");

/**
 * Full sign-in through the REAL handlers: password, then the emailed code. The code is read from the email the server sends (the mailer
 * a suite installed keeps receiving every message too). Returns every cookie issued.
 */
export async function loginSession(email: string, password = PASSWORD, source = "10.0.0.1") {
  return (await loginSessionWithResponse(email, password, source)).jar;
}

/** Same sign-in, also returning the final response's Set-Cookie lines and body (for tests that inspect cookie attributes). */
export async function loginSessionWithResponse(email: string, password = PASSWORD, source = "10.0.0.1") {
  const login = await import("@/app/api/auth/login/route");
  const mfa = await import("@/app/api/auth/mfa/verify/route");
  const db = getDb();
  const account = await db.adminUser.findUnique({ where: { email }, select: { id: true } });
  if (account) {
    // A fresh code is always sent: forget any earlier unused code and this account's hourly code allowance.
    await db.authChallenge.updateMany({ where: { userId: account.id, purpose: "login", consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
    await db.rateLimit.deleteMany({ where: { key: { contains: `login-code:acct:${account.id}` } } });
  }
  const previous = getMailerOverride();
  let code = "";
  setMailer({
    send: async (m) => {
      if (m.to === email) code = /(\d{3}) (\d{3})/.exec(m.text)?.slice(1, 3).join("") ?? code;
      return previous ? previous.send(m) : { delivered: true, providerMessageId: "test" };
    },
  });
  try {
    const r = await call(login.POST as Handler, { method: "POST", url: "/api/auth/login", body: { email, password }, headers: { "x-forwarded-for": source } });
    if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.data)}`);
    const jar = cookieJar(r);
    if (!code) throw new Error(`no sign-in code was emailed to ${email}`);
    const v = await call(mfa.POST as Handler, { method: "POST", url: "/api/auth/mfa/verify", body: { code }, cookie: cookieHeader(jar), headers: { "x-forwarded-for": source } });
    if (v.status !== 200) throw new Error(`sign-in code rejected for ${email}: ${v.status} ${JSON.stringify(v.data)}`);
    return { jar: cookieJar(v), lines: v.headers.getSetCookie(), data: v.data };
  } finally {
    setMailer(previous);
  }
}

/** The cookie header the API handlers need for authenticated calls (the access token). */
export async function loginCookie(email: string, password = PASSWORD) {
  const jar = await loginSession(email, password);
  return `hv_at=${encodeURIComponent(jar.hv_at)}`;
}

export async function resetData() {
  const db = getDb();
  await db.rateLimit.deleteMany();
  await db.authChallenge.deleteMany();
  await db.activityLog.deleteMany();
  await db.session.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();
}
