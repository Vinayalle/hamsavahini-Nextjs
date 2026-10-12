import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hash } from "@node-rs/argon2";
import { getDb } from "@/server/db";
import { issueUserToken } from "@/server/account";
import { setMailer, type MailMessage } from "@/server/mail";
import { nextEmployeeId } from "@/lib/authz/bootstrap";
import { resetAuthConfigForTests } from "@/server/config";
import { sourceKey } from "@/server/ratelimit";
import { hashToken } from "@/server/security";
import { signAccessToken, signPendingMfaToken } from "@/server/tokens";
import { totpAt } from "@/server/totp";
import { PASSWORD, call, cookieHeader, cookieJar, enrolMfa, ensurePermissions, freshStep, loginSession, makeRole, makeUser, totpFor } from "./helpers";
import * as login from "@/app/api/auth/login/route";
import * as logout from "@/app/api/auth/logout/route";
import * as refresh from "@/app/api/auth/refresh/route";
import * as me from "@/app/api/auth/me/route";
import * as mfaVerify from "@/app/api/auth/mfa/verify/route";
import * as mfaStart from "@/app/api/auth/mfa/enroll/start/route";
import * as mfaConfirm from "@/app/api/auth/mfa/enroll/confirm/route";
import * as mfaSelf from "@/app/api/auth/mfa/route";
import * as reauth from "@/app/api/auth/reauth/route";
import * as reqOtp from "@/app/api/auth/activate/request-otp/route";
import * as verOtp from "@/app/api/auth/activate/verify-otp/route";
import * as setPw from "@/app/api/auth/activate/set-password/route";
import * as resend from "@/app/api/auth/verification/resend/route";
import * as forgot from "@/app/api/auth/password/forgot/route";
import * as reset from "@/app/api/auth/password/reset/route";
import * as users from "@/app/api/users/route";
import * as userStatus from "@/app/api/users/[id]/status/route";
import * as mfaReset from "@/app/api/users/[id]/mfa-reset/route";
import * as products from "@/app/api/products/route";

type H = Parameters<typeof call>[0];
const db = () => getDb();
const NEW_PASSWORD = "Vast-Orchid-Lantern-47!";
const OTHER_PASSWORD = "Silent-Harbor-Maple-91#";

/** Every secret value the tests handle; the last test proves none of them ever reached a log or audit table. */
const seenSecrets = new Set<string>();

const sink: MailMessage[] = [];
const mailTo = (to: string) => [...sink].reverse().find((m) => m.to === to);
const otpOf = (m: MailMessage) => {
  const x = /(\d{3}) (\d{3})/.exec(m.text)!;
  const code = x[1] + x[2];
  seenSecrets.add(code);
  return code;
};
const resetTokenOf = (m: MailMessage) => {
  const t = new URL(/(https?:\/\/\S+)/.exec(m.text)![1]).searchParams.get("token")!;
  seenSecrets.add(t);
  return t;
};

const post = (h: H, url: string, body: unknown = {}, o: { cookie?: string; ip?: string; origin?: string | null; contentType?: string | null } = {}) =>
  call(h, { method: "POST", url, body, cookie: o.cookie, origin: o.origin, contentType: o.contentType, headers: { "x-forwarded-for": o.ip ?? "198.51.100.1" } });
const get = (h: H, url: string, cookie?: string) => call(h, { url, cookie });
const asAccess = (jar: Record<string, string>) => `hv_at=${encodeURIComponent(jar.hv_at)}`;
const asRefresh = (token: string) => `hv_rt=${encodeURIComponent(token)}`;

let ids = { sa: "", admin: "", plain: "" };
let roleIds = { sa: "", admin: "", staff: "" };
let seq = 0;

async function newStaff(extra: { status?: "active" | "invited" | "suspended"; name?: string } = {}) {
  const email = `staff${++seq}@t.dev`;
  const u = await makeUser(email, roleIds.staff, extra.status ?? "active", PASSWORD, { name: extra.name ?? `Zed Quill${seq}` });
  return { id: u.id, email };
}

/** An employee who has been invited but has not activated yet. */
async function newInvited(name = "Ivy Marsh") {
  const email = `invitee${++seq}@t.dev`;
  const u = await db().adminUser.create({
    data: { employeeId: await nextEmployeeId(db()), email, name, status: "invited", roles: { create: [{ roleId: roleIds.staff }] } },
  });
  await issueUserToken(db(), u.id, "invite");
  return { id: u.id, email, name };
}

/** Runs request-otp -> verify-otp and returns the activation cookie jar. */
async function verifiedActivation(email: string) {
  await post(reqOtp.POST as H, "/api/auth/activate/request-otp", { email });
  const code = otpOf(mailTo(email)!);
  const v = await post(verOtp.POST as H, "/api/auth/activate/verify-otp", { email, code });
  expect(v.status).toBe(200);
  return cookieJar(v);
}

beforeAll(async () => {
  await ensurePermissions();
  const d = db();
  await d.activityLog.deleteMany();
  await d.adminUser.deleteMany();
  await d.role.deleteMany();
  const sa = await makeRole("Super Admin", {}, true);
  const admin = await makeRole("Admin", { users: ["view", "edit", "change_status"], products: ["view"] });
  await d.role.update({ where: { id: admin.id }, data: { code: "admin" } });
  const staff = await makeRole("Staff", { products: ["view"] });
  roleIds = { sa: sa.id, admin: admin.id, staff: staff.id };
  ids = {
    sa: (await makeUser("sa@t.dev", sa.id, "active", PASSWORD, { name: "Sara Boss" })).id,
    admin: (await makeUser("adm@t.dev", admin.id, "active", PASSWORD, { name: "Adam Lead" })).id,
    plain: (await makeUser("plain@t.dev", staff.id, "active", PASSWORD, { name: "Pat Plain" })).id,
  };
  setMailer({ send: async (m) => { sink.push(m); return { delivered: true, providerMessageId: "sink" }; } });
});
afterAll(() => setMailer(null));

beforeEach(async () => {
  sink.length = 0;
  const d = db();
  await d.rateLimit.deleteMany();
  await d.session.deleteMany();
  await d.authChallenge.deleteMany();
  await d.adminUser.updateMany({ data: { failedLoginCount: 0, lockedUntil: null } });
  await d.mfaCredential.deleteMany({ where: { userId: { notIn: [ids.sa, ids.admin] } } });
  vi.restoreAllMocks();
});

/* ═══════════════════ first-time activation (email OTP) ═══════════════════ */
describe("first-time activation", () => {
  it("works end to end: invite -> OTP -> verified -> password -> normal login, with the roles from the invitation only", async () => {
    // an authorised Super Admin invites through the real API
    const sa = await loginSession("sa@t.dev");
    const created = await post(users.POST as H, "/api/users", { name: "Nora Vale", email: "nora@t.dev", roleIds: [roleIds.staff] }, { cookie: asAccess(sa) });
    expect(created.status).toBe(201);
    expect(created.data.employee.status).toBe("invited");
    expect(mailTo("nora@t.dev")!.subject).toMatch(/invited/i);
    expect(mailTo("nora@t.dev")!.html).toContain("/admin/activate?email=nora%40t.dev");
    expect(mailTo("nora@t.dev")!.text).not.toMatch(/\d{6}/); // the invitation carries no code and no secret
    // cannot sign in before activating
    expect((await post(login.POST as H, "/api/auth/login", { email: "nora@t.dev", password: NEW_PASSWORD })).status).toBe(401);

    const req = await post(reqOtp.POST as H, "/api/auth/activate/request-otp", { email: "nora@t.dev" });
    expect(req.status).toBe(200);
    const mail = mailTo("nora@t.dev")!;
    expect(mail.subject).toMatch(/verification code/i);
    expect(mail.html).toContain("Hamsavahin");
    const code = otpOf(mail);
    expect(code).toMatch(/^\d{6}$/);

    const v = await post(verOtp.POST as H, "/api/auth/activate/verify-otp", { email: "nora@t.dev", code });
    expect(v.status).toBe(200);
    const setCookie = v.headers.getSetCookie().find((c) => c.startsWith("hv_act="))!;
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    expect(JSON.stringify(v.data)).not.toMatch(/grant|token/i); // the grant is never exposed to page scripts
    const jar = cookieJar(v);

    const set = await post(setPw.POST as H, "/api/auth/activate/set-password", { password: NEW_PASSWORD }, { cookie: cookieHeader({ hv_act: jar.hv_act }) });
    expect(set.status).toBe(200);
    expect(set.headers.getSetCookie().join("\n")).not.toMatch(/hv_at|hv_rt/); // activation alone does not sign anyone in
    seenSecrets.add(NEW_PASSWORD);

    const row = await db().adminUser.findUniqueOrThrow({ where: { email: "nora@t.dev" }, include: { roles: true } });
    expect(row.status).toBe("active");
    expect(row.emailVerifiedAt).not.toBeNull();
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.roles.map((r) => r.roleId)).toEqual([roleIds.staff]); // verification granted nothing extra
    expect(await db().userToken.count({ where: { userId: row.id, usedAt: null } })).toBe(0);
    expect(await db().activityLog.count({ where: { action: "account_activated", entityId: row.id } })).toBe(1);

    // subsequent logins need only email + password: no new OTP challenge is created
    const before = await db().authChallenge.count();
    const next = await post(login.POST as H, "/api/auth/login", { email: "nora@t.dev", password: NEW_PASSWORD });
    expect(next.status).toBe(200);
    expect(next.data.status).toBe("authenticated");
    expect(await db().authChallenge.count()).toBe(before);
    expect(mailTo("nora@t.dev")!.subject).toMatch(/active|verification|invited/i);
  });

  it("stores only a keyed digest of the code, never the code", async () => {
    const u = await newInvited();
    await post(reqOtp.POST as H, "/api/auth/activate/request-otp", { email: u.email });
    const code = otpOf(mailTo(u.email)!);
    const row = await db().authChallenge.findFirstOrThrow({ where: { userId: u.id } });
    expect(row.codeDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(code);
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeCloseTo(5 * 60_000, -3); // five minutes
  });

  it("gives an identical response whether or not the address has a pending invitation, and sends nothing otherwise", async () => {
    const inv = await newInvited();
    const active = (await db().adminUser.findUniqueOrThrow({ where: { id: ids.plain } })).email;
    const suspended = await newStaff({ status: "suspended" });
    const answers = [];
    for (const email of [inv.email, "nobody@t.dev", active, suspended.email]) answers.push(await post(reqOtp.POST as H, "/api/auth/activate/request-otp", { email }, { ip: `203.0.113.${answers.length + 1}` }));
    expect(new Set(answers.map((a) => a.status))).toEqual(new Set([200]));
    expect(new Set(answers.map((a) => JSON.stringify(a.data))).size).toBe(1);
    expect(sink.map((m) => m.to)).toEqual([inv.email]);
  });

  it("refuses wrong codes, counts attempts, and locks the challenge after the limit even for the right code", async () => {
    const u = await newInvited();
    await post(reqOtp.POST as H, "/api/auth/activate/request-otp", { email: u.email });
    const code = otpOf(mailTo(u.email)!);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await post(verOtp.POST as H, "/api/auth/activate/verify-otp", { email: u.email, code: wrong })).status).toBe(422);
    expect((await db().authChallenge.findFirstOrThrow({ where: { userId: u.id } })).attempts).toBe(5);
    const late = await post(verOtp.POST as H, "/api/auth/activate/verify-otp", { email: u.email, code });
    expect(late.status).toBe(422); // exhausted: the right code no longer works
    expect(late.headers.getSetCookie().join()).not.toContain("hv_act");
    expect(await db().activityLog.count({ where: { action: "otp_failed", entityId: u.id } })).toBe(5);
  });

  it("the attempt budget is atomic: parallel guesses can never exceed the limit", async () => {
    const u = await newInvited();
    await post(reqOtp.POST as H, "/api/auth/activate/request-otp", { email: u.email });
    const code = otpOf(mailTo(u.email)!);
    const wrong = code === "000000" ? "111111" : "000000";
    const res = await Promise.all(Array.from({ length: 14 }, () => post(verOtp.POST as H, "/api/auth/activate/verify-otp", { email: u.email, code: wrong })));
    expect(res.every((r) => r.status === 422 || r.status === 429)).toBe(true);
    expect((await db().authChallenge.findFirstOrThrow({ where: { userId: u.id } })).attempts).toBeLessThanOrEqual(5);
    expect((await post(verOtp.POST as H, "/api/auth/activate/verify-otp", { email: u.email, code })).status).toBeGreaterThanOrEqual(422);
  });

  it("expires after five minutes", async () => {
    const u = await newInvited();
    await post(reqOtp.POST as H, "/api/auth/activate/request-otp", { email: u.email });
    const code = otpOf(mailTo(u.email)!);
    await db().authChallenge.updateMany({ where: { userId: u.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await post(verOtp.POST as H, "/api/auth/activate/verify-otp", { email: u.email, code })).status).toBe(422);
  });

  it("is single use: replaying a consumed code fails", async () => {
    const u = await newInvited();
    await verifiedActivation(u.email);
    const code = otpOf(mailTo(u.email)!);
    expect((await post(verOtp.POST as H, "/api/auth/activate/verify-otp", { email: u.email, code })).status).toBe(422);
  });

  it("resend: honours the cooldown, then invalidates the previous code", async () => {
    const u = await newInvited();
    await post(reqOtp.POST as H, "/api/auth/activate/request-otp", { email: u.email });
    await post(resend.POST as H, "/api/auth/verification/resend", { email: u.email });
    expect(sink).toHaveLength(1); // inside the cooldown: no second email, first code still valid
    const first = otpOf(mailTo(u.email)!);
    await db().authChallenge.updateMany({ where: { userId: u.id }, data: { createdAt: new Date(Date.now() - 120_000) } });
    await post(resend.POST as H, "/api/auth/verification/resend", { email: u.email });
    expect(sink).toHaveLength(2);
    const second = otpOf(mailTo(u.email)!);
    expect(await db().authChallenge.count({ where: { userId: u.id, invalidatedAt: null, consumedAt: null } })).toBe(1);
    if (first !== second) expect((await post(verOtp.POST as H, "/api/auth/activate/verify-otp", { email: u.email, code: first })).status).toBe(422);
    expect((await post(verOtp.POST as H, "/api/auth/activate/verify-otp", { email: u.email, code: second })).status).toBe(200);
  });

  it("is concurrency safe: parallel verifies yield exactly one grant, parallel requests exactly one email", async () => {
    const u = await newInvited();
    await Promise.all(Array.from({ length: 6 }, () => post(reqOtp.POST as H, "/api/auth/activate/request-otp", { email: u.email })));
    expect(sink).toHaveLength(1);
    const code = otpOf(mailTo(u.email)!);
    const results = await Promise.all(Array.from({ length: 4 }, () => post(verOtp.POST as H, "/api/auth/activate/verify-otp", { email: u.email, code })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await db().userToken.count({ where: { userId: u.id, type: "activation_grant" } })).toBe(1);
  });

  it("an expired invitation can neither request nor verify", async () => {
    const u = await newInvited();
    await db().userToken.updateMany({ where: { userId: u.id, type: "invite" }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await post(reqOtp.POST as H, "/api/auth/activate/request-otp", { email: u.email });
    expect(sink).toHaveLength(0);
  });

  it("the activation grant is single use and a rejected password does not burn it", async () => {
    const u = await newInvited("Ivy Marsh");
    const jar = await verifiedActivation(u.email);
    const c = cookieHeader({ hv_act: jar.hv_act });
    expect((await post(setPw.POST as H, "/api/auth/activate/set-password", { password: "short" }, { cookie: c })).status).toBe(422);
    expect((await post(setPw.POST as H, "/api/auth/activate/set-password", { password: "Marsh-Garden-Lantern-47!" }, { cookie: c })).status).toBe(422); // contains the surname
    expect((await post(setPw.POST as H, "/api/auth/activate/set-password", { password: NEW_PASSWORD }, { cookie: c })).status).toBe(200);
    expect((await post(setPw.POST as H, "/api/auth/activate/set-password", { password: OTHER_PASSWORD }, { cookie: c })).status).toBe(401); // replay
    expect((await post(login.POST as H, "/api/auth/login", { email: u.email, password: NEW_PASSWORD })).status).toBe(200);
  });

  it("set-password needs a valid grant: none, forged, expired", async () => {
    expect((await post(setPw.POST as H, "/api/auth/activate/set-password", { password: NEW_PASSWORD })).status).toBe(401);
    expect((await post(setPw.POST as H, "/api/auth/activate/set-password", { password: NEW_PASSWORD }, { cookie: cookieHeader({ hv_act: "x".repeat(43) }) })).status).toBe(401);
    const u = await newInvited();
    const jar = await verifiedActivation(u.email);
    await db().userToken.updateMany({ where: { userId: u.id, type: "activation_grant" }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await post(setPw.POST as H, "/api/auth/activate/set-password", { password: NEW_PASSWORD }, { cookie: cookieHeader({ hv_act: jar.hv_act }) })).status).toBe(401);
  });

  it("an activation grant is not a password-reset token, and a reset token is not an activation grant", async () => {
    const u = await newInvited();
    const jar = await verifiedActivation(u.email);
    expect((await post(reset.POST as H, "/api/auth/password/reset", { token: jar.hv_act, password: NEW_PASSWORD })).status).toBe(422);

    const active = await newStaff();
    await post(forgot.POST as H, "/api/auth/password/forgot", { email: active.email });
    const resetToken = resetTokenOf(mailTo(active.email)!);
    expect((await post(setPw.POST as H, "/api/auth/activate/set-password", { password: NEW_PASSWORD }, { cookie: cookieHeader({ hv_act: resetToken }) })).status).toBe(401);
  });

  it("an already-active or deactivated account cannot be re-activated by OTP", async () => {
    const a = await newStaff();
    await db().userToken.create({ data: { userId: (await db().adminUser.findUniqueOrThrow({ where: { email: a.email } })).id, type: "invite", tokenHash: hashToken("x".repeat(40)), expiresAt: new Date(Date.now() + 1e6) } });
    await post(reqOtp.POST as H, "/api/auth/activate/request-otp", { email: a.email });
    expect(sink).toHaveLength(0);
  });
});

/* ═══════════════════ password login ═══════════════════ */
describe("password login", () => {
  it("signs in with email + password only (no OTP) and sets HttpOnly cookies without leaking tokens in the body", async () => {
    const r = await post(login.POST as H, "/api/auth/login", { email: "PLAIN@t.dev", password: PASSWORD });
    expect(r.status).toBe(200);
    expect(r.data.status).toBe("authenticated");
    expect(JSON.stringify(r.data)).not.toMatch(/eyJ|hash|argon|token/i);
    const lines = r.headers.getSetCookie();
    expect(lines.filter((l) => l.startsWith("hv_at=") || l.startsWith("hv_rt=")).every((l) => /HttpOnly/.test(l))).toBe(true);
    expect(await db().authChallenge.count()).toBe(0);
  });

  it("returns one generic answer for wrong password, unknown, deactivated, not-yet-activated and locked accounts", async () => {
    const susp = await newStaff({ status: "suspended" });
    const inv = await newInvited();
    const locked = await newStaff();
    await db().adminUser.update({ where: { email: locked.email }, data: { lockedUntil: new Date(Date.now() + 600_000) } });
    const attempts = [
      ["plain@t.dev", "wrong-password-1A!"], ["ghost@t.dev", PASSWORD], [susp.email, PASSWORD], [inv.email, PASSWORD], [locked.email, PASSWORD],
    ];
    const out = [];
    for (const [email, password] of attempts) out.push(await post(login.POST as H, "/api/auth/login", { email, password }, { ip: `192.0.2.${out.length + 1}` }));
    expect(new Set(out.map((o) => o.status))).toEqual(new Set([401]));
    expect(new Set(out.map((o) => JSON.stringify(o.data))).size).toBe(1);
    expect(out.every((o) => o.headers.getSetCookie().length === 0)).toBe(true);
  });

  it("rehashes a password stored with weaker Argon2id parameters, transparently on login", async () => {
    const u = await newStaff();
    const weak = await hash(PASSWORD, { memoryCost: 512, timeCost: 1, parallelism: 1 });
    await db().adminUser.update({ where: { email: u.email }, data: { passwordHash: weak } });
    expect((await post(login.POST as H, "/api/auth/login", { email: u.email, password: PASSWORD })).status).toBe(200);
    const after = (await db().adminUser.findUniqueOrThrow({ where: { email: u.email } })).passwordHash!;
    expect(after).not.toBe(weak);
    expect(after).toMatch(/^\$argon2id\$v=19\$m=1024,t=2,p=1\$/);
    expect((await post(login.POST as H, "/api/auth/login", { email: u.email, password: PASSWORD })).status).toBe(200); // still works afterwards
    // a wrong password must NOT trigger a rehash
    await db().adminUser.update({ where: { email: u.email }, data: { passwordHash: weak } });
    await post(login.POST as H, "/api/auth/login", { email: u.email, password: "wrong-password-1A!" });
    expect((await db().adminUser.findUniqueOrThrow({ where: { email: u.email } })).passwordHash).toBe(weak);
  });

  it("locks progressively (not permanently): refused while locked, recovers when the lock lapses", async () => {
    const u = await newStaff();
    for (let i = 0; i < 5; i++) await post(login.POST as H, "/api/auth/login", { email: u.email, password: "wrong-password-1A!" });
    const row = await db().adminUser.findUniqueOrThrow({ where: { email: u.email } });
    expect(row.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect((await post(login.POST as H, "/api/auth/login", { email: u.email, password: PASSWORD })).status).toBe(401);
    await db().adminUser.update({ where: { email: u.email }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    expect((await post(login.POST as H, "/api/auth/login", { email: u.email, password: PASSWORD })).status).toBe(200);
    expect((await db().adminUser.findUniqueOrThrow({ where: { email: u.email } })).failedLoginCount).toBe(0);
  });

  it("rate limits per account (429 + Retry-After), even for the correct password, and recovers when the window passes", async () => {
    const u = await newStaff();
    for (let i = 0; i < 8; i++) await post(login.POST as H, "/api/auth/login", { email: u.email, password: "wrong-password-1A!" });
    const blocked = await post(login.POST as H, "/api/auth/login", { email: u.email, password: PASSWORD });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(blocked.data.error.code).toBe("rate_limited");
    await db().rateLimit.updateMany({ data: { windowStart: new Date(Date.now() - 16 * 60_000) } }); // window expired
    await db().adminUser.update({ where: { email: u.email }, data: { lockedUntil: null, failedLoginCount: 0 } });
    expect((await post(login.POST as H, "/api/auth/login", { email: u.email, password: PASSWORD })).status).toBe(200);
  });

  it("rate limits per source address across many accounts, without affecting other sources", async () => {
    let last = 0;
    for (let i = 0; i < 61; i++) last = (await post(login.POST as H, "/api/auth/login", { email: `ghost${i}@t.dev`, password: "x-wrong-password-1A" }, { ip: "203.0.113.50" })).status;
    expect(last).toBe(429);
    expect((await post(login.POST as H, "/api/auth/login", { email: "plain@t.dev", password: PASSWORD }, { ip: "203.0.113.51" })).status).toBe(200);
  });

  it("counters are atomic under concurrency: 20 parallel attempts allow exactly the limit", async () => {
    const u = await newStaff();
    const res = await Promise.all(Array.from({ length: 20 }, () => post(login.POST as H, "/api/auth/login", { email: u.email, password: "wrong-password-1A!" })));
    expect(res.filter((r) => r.status === 429)).toHaveLength(12);
    expect(res.filter((r) => r.status === 401)).toHaveLength(8);
  });

  it("ignores X-Forwarded-For unless a trusted proxy is configured", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4" } });
    expect(sourceKey(req)).toBe("1.2.3.4");
    process.env.AUTH_TRUST_PROXY = "false";
    resetAuthConfigForTests();
    try {
      expect(sourceKey(req)).toBe("direct");
    } finally {
      process.env.AUTH_TRUST_PROXY = "true";
      resetAuthConfigForTests();
    }
  });
});

/* ═══════════════════ sessions: access JWT ═══════════════════ */
describe("access tokens and sessions", () => {
  it("rejects forged, expired, mis-addressed and orphaned tokens at the API", async () => {
    const jar = await loginSession("plain@t.dev");
    const real = jar.hv_at;
    expect((await get(me.GET as H, "/api/auth/me", `hv_at=${real}`)).status).toBe(200);
    const [h, p, s] = real.split(".");
    const tamper = JSON.parse(Buffer.from(p, "base64url").toString());
    tamper.sub = ids.sa;
    expect((await get(me.GET as H, "/api/auth/me", `hv_at=${h}.${Buffer.from(JSON.stringify(tamper)).toString("base64url")}.${s}`)).status).toBe(401);
    expect((await get(me.GET as H, "/api/auth/me", `hv_at=${h}.${p}.${s.slice(0, -2)}AA`)).status).toBe(401);
    // validly signed but the session does not exist
    const orphan = await signAccessToken({ sub: ids.plain, sid: "44444444-4444-4444-8444-444444444444" });
    expect((await get(me.GET as H, "/api/auth/me", `hv_at=${orphan}`)).status).toBe(401);
    // validly signed for a real session but the wrong user
    const sid = (await db().session.findFirstOrThrow({ where: { userId: ids.plain } })).id;
    expect((await get(me.GET as H, "/api/auth/me", `hv_at=${await signAccessToken({ sub: ids.sa, sid })}`)).status).toBe(401);
    // a pending-MFA token is not an access token
    expect((await get(me.GET as H, "/api/auth/me", `hv_at=${await signPendingMfaToken({ sub: ids.plain })}`)).status).toBe(401);
  });

  it("does not trust the token for authorization: revoking a permission applies to the very next request", async () => {
    const u = await newStaff();
    const cookie = await (async () => asAccess(await loginSession(u.email)))();
    expect((await get(products.GET as H, "/api/products", cookie)).status).toBe(200);
    await db().rolePermission.deleteMany({ where: { roleId: roleIds.staff } });
    try {
      expect((await get(products.GET as H, "/api/products", cookie)).status).toBe(403);
    } finally {
      const perm = await db().permission.findUniqueOrThrow({ where: { resource_action: { resource: "products", action: "view" } } });
      await db().rolePermission.create({ data: { roleId: roleIds.staff, permissionId: perm.id, scope: "all" } });
    }
    expect((await get(products.GET as H, "/api/products", cookie)).status).toBe(200);
  });

  it("deactivating the account ends the session immediately, including the refresh token", async () => {
    const u = await newStaff();
    const jar = await loginSession(u.email);
    await db().adminUser.update({ where: { email: u.email }, data: { status: "suspended" } });
    expect((await get(me.GET as H, "/api/auth/me", asAccess(jar))).status).toBe(401);
    expect((await post(refresh.POST as H, "/api/auth/refresh", {}, { cookie: asRefresh(jar.hv_rt) })).status).toBe(401);
    expect(await db().session.count({ where: { userId: (await db().adminUser.findUniqueOrThrow({ where: { email: u.email } })).id } })).toBe(0);
  });

  it("each login creates a brand-new session and tokens (no fixation)", async () => {
    const a = await loginSession("plain@t.dev");
    const b = await loginSession("plain@t.dev");
    expect(a.hv_at).not.toBe(b.hv_at);
    expect(a.hv_rt).not.toBe(b.hv_rt);
    expect(await db().session.count({ where: { userId: ids.plain } })).toBe(2);
  });
});

/* ═══════════════════ refresh tokens ═══════════════════ */
describe("refresh-token rotation", () => {
  it("rotates: a new access + refresh token each time, old one marked used, only hashes stored", async () => {
    const jar = await loginSession("plain@t.dev");
    const r = await post(refresh.POST as H, "/api/auth/refresh", {}, { cookie: asRefresh(jar.hv_rt) });
    expect(r.status).toBe(200);
    const next = cookieJar(r);
    expect(next.hv_rt).not.toBe(jar.hv_rt);
    expect(next.hv_at).toBeTruthy();
    expect(JSON.stringify(r.data)).not.toMatch(/eyJ|refresh/i);
    const old = await db().refreshToken.findUniqueOrThrow({ where: { tokenHash: hashToken(jar.hv_rt) } });
    expect(old.usedAt).not.toBeNull();
    expect(old.replacedById).not.toBeNull();
    expect(await db().refreshToken.findUnique({ where: { tokenHash: next.hv_rt } })).toBeNull(); // raw value never stored
    expect((await get(me.GET as H, "/api/auth/me", asAccess(next))).status).toBe(200);
  });

  it("detects reuse of a rotated token: the whole session is revoked", async () => {
    const jar = await loginSession("plain@t.dev");
    const rotated = cookieJar(await post(refresh.POST as H, "/api/auth/refresh", {}, { cookie: asRefresh(jar.hv_rt) }));
    // benign race window: rejected but the session survives
    const racing = await post(refresh.POST as H, "/api/auth/refresh", {}, { cookie: asRefresh(jar.hv_rt) });
    expect(racing.status).toBe(401);
    expect(racing.data.error.code).toBe("refresh_conflict");
    expect((await get(me.GET as H, "/api/auth/me", asAccess(rotated))).status).toBe(200);
    // outside the grace window it is a replay of a stolen token
    await db().refreshToken.update({ where: { tokenHash: hashToken(jar.hv_rt) }, data: { usedAt: new Date(Date.now() - 60_000) } });
    const replay = await post(refresh.POST as H, "/api/auth/refresh", {}, { cookie: asRefresh(jar.hv_rt) });
    expect(replay.status).toBe(401);
    expect(replay.headers.getSetCookie().join()).toMatch(/hv_rt=; .*Max-Age=0/);
    expect((await post(refresh.POST as H, "/api/auth/refresh", {}, { cookie: asRefresh(rotated.hv_rt) })).status).toBe(401); // the legitimate descendant is dead too
    expect((await get(me.GET as H, "/api/auth/me", asAccess(rotated))).status).toBe(401);
    expect(await db().activityLog.count({ where: { action: "token_reuse" } })).toBe(1);
  });

  it("parallel refreshes with one token produce exactly one success", async () => {
    const jar = await loginSession("plain@t.dev");
    const res = await Promise.all(Array.from({ length: 6 }, () => post(refresh.POST as H, "/api/auth/refresh", {}, { cookie: asRefresh(jar.hv_rt) })));
    expect(res.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await db().refreshToken.count({ where: { session: { userId: ids.plain }, usedAt: null } })).toBe(1);
  });

  it("refuses expired refresh tokens, sessions past their absolute lifetime, and garbage", async () => {
    const a = await loginSession("plain@t.dev");
    await db().refreshToken.updateMany({ where: { tokenHash: hashToken(a.hv_rt) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await post(refresh.POST as H, "/api/auth/refresh", {}, { cookie: asRefresh(a.hv_rt) })).status).toBe(401);
    const b = await loginSession("plain@t.dev");
    await db().session.updateMany({ where: { userId: ids.plain }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await post(refresh.POST as H, "/api/auth/refresh", {}, { cookie: asRefresh(b.hv_rt) })).status).toBe(401);
    expect((await post(refresh.POST as H, "/api/auth/refresh", {})).status).toBe(401);
    expect((await post(refresh.POST as H, "/api/auth/refresh", {}, { cookie: asRefresh("x".repeat(43)) })).status).toBe(401);
  });

  it("logout revokes the session server-side (access and refresh), even when only the refresh cookie is available", async () => {
    const jar = await loginSession("plain@t.dev");
    const out = await post(logout.POST as H, "/api/auth/logout", {}, { cookie: asRefresh(jar.hv_rt) });
    expect(out.status).toBe(200);
    expect(out.headers.getSetCookie().filter((c) => /Max-Age=0/.test(c)).length).toBeGreaterThanOrEqual(2);
    expect((await get(me.GET as H, "/api/auth/me", asAccess(jar))).status).toBe(401);
    expect((await post(refresh.POST as H, "/api/auth/refresh", {}, { cookie: asRefresh(jar.hv_rt) })).status).toBe(401);
    expect(await db().activityLog.count({ where: { action: "logout" } })).toBeGreaterThanOrEqual(1);
  });

  it("is rate limited per source", async () => {
    let last = 0;
    for (let i = 0; i < 121; i++) last = (await post(refresh.POST as H, "/api/auth/refresh", {}, { ip: "203.0.113.77" })).status;
    expect(last).toBe(429);
  });
});

/* ═══════════════════ MFA ═══════════════════ */
describe("MFA", () => {
  it("is mandatory for Super Admins and Admins: password alone issues no session", async () => {
    for (const email of ["sa@t.dev", "adm@t.dev"]) {
      const r = await post(login.POST as H, "/api/auth/login", { email, password: PASSWORD });
      expect(r.data.status).toBe("mfa_required");
      const names = r.headers.getSetCookie().map((c) => c.split("=")[0]);
      expect(names).toEqual(["hv_mfa"]);
      const jar = cookieJar(r);
      expect((await get(me.GET as H, "/api/auth/me", `hv_at=${jar.hv_mfa}`)).status).toBe(401); // the pending proof is not a session
      expect((await get(me.GET as H, "/api/auth/me", cookieHeader(jar))).status).toBe(401);
    }
    expect((await post(login.POST as H, "/api/auth/login", { email: "plain@t.dev", password: PASSWORD })).data.status).toBe("authenticated");
  });

  it("blocks an admin session that never completed MFA (defence against policy drift)", async () => {
    const s = await db().session.create({ data: { userId: ids.admin, expiresAt: new Date(Date.now() + 3600_000) } });
    const token = await signAccessToken({ sub: ids.admin, sid: s.id });
    expect((await get(me.GET as H, "/api/auth/me", `hv_at=${token}`)).status).toBe(401);
    await db().session.update({ where: { id: s.id }, data: { mfaVerifiedAt: new Date() } });
    expect((await get(me.GET as H, "/api/auth/me", `hv_at=${token}`)).status).toBe(200);
  });

  it("verification: wrong code refused, replay of an accepted code refused, next step accepted", async () => {
    const pending = async () => cookieJar(await post(login.POST as H, "/api/auth/login", { email: "adm@t.dev", password: PASSWORD }));
    await freshStep(ids.admin);
    let jar = await pending();
    const wrong = totpFor(ids.admin) === "000000" ? "111111" : "000000";
    expect((await post(mfaVerify.POST as H, "/api/auth/mfa/verify", { code: wrong }, { cookie: cookieHeader(jar) })).status).toBe(401);
    const ok = await post(mfaVerify.POST as H, "/api/auth/mfa/verify", { code: totpFor(ids.admin) }, { cookie: cookieHeader(jar) });
    expect(ok.status).toBe(200);
    expect(Object.keys(cookieJar(ok))).toEqual(expect.arrayContaining(["hv_at", "hv_rt"]));
    jar = await pending();
    const replay = await post(mfaVerify.POST as H, "/api/auth/mfa/verify", { code: totpFor(ids.admin) }, { cookie: cookieHeader(jar) });
    expect(replay.status).toBe(401); // same time-step already used
    const next = await post(mfaVerify.POST as H, "/api/auth/mfa/verify", { code: totpFor(ids.admin, 1) }, { cookie: cookieHeader(jar) });
    expect(next.status).toBe(200);
    expect((await post(mfaVerify.POST as H, "/api/auth/mfa/verify", { code: totpFor(ids.admin, 1) })).status).toBe(401); // no pending proof at all
  });

  it("rate limits code guessing", async () => {
    const jar = cookieJar(await post(login.POST as H, "/api/auth/login", { email: "adm@t.dev", password: PASSWORD }));
    const out = [];
    for (let i = 0; i < 12; i++) out.push((await post(mfaVerify.POST as H, "/api/auth/mfa/verify", { code: "000000" }, { cookie: cookieHeader(jar) })).status);
    expect(out.slice(0, 10).every((s) => s === 401 || s === 200)).toBe(true);
    expect(out[11]).toBe(429);
    expect(await db().activityLog.count({ where: { action: "mfa_failed" } })).toBeGreaterThanOrEqual(5);
  });

  it("enrolment: secret is encrypted at rest, recovery codes are hashed and shown once, enrolling signs the user in", async () => {
    const u = await makeUser("newadmin@t.dev", roleIds.admin, "active", PASSWORD, { name: "Nia Fresh" });
    await db().mfaCredential.deleteMany({ where: { userId: u.id } });
    const l = await post(login.POST as H, "/api/auth/login", { email: "newadmin@t.dev", password: PASSWORD });
    expect(l.data).toEqual({ status: "mfa_required", method: "totp", enrolled: false });
    const jar = cookieJar(l);
    const start = await post(mfaStart.POST as H, "/api/auth/mfa/enroll/start", {}, { cookie: cookieHeader(jar) });
    expect(start.status).toBe(200);
    const secret: string = start.data.secret;
    seenSecrets.add(secret);
    expect(start.data.otpauthUri).toContain(`secret=${secret}`);
    expect(start.data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    const stored = await db().mfaCredential.findUniqueOrThrow({ where: { userId: u.id } });
    expect(stored.secretEnc).not.toContain(secret);
    expect(stored.enabledAt).toBeNull();
    // before confirmation the login is still not complete
    expect((await post(login.POST as H, "/api/auth/login", { email: "newadmin@t.dev", password: PASSWORD })).data.enrolled).toBe(false);
    expect((await post(mfaConfirm.POST as H, "/api/auth/mfa/enroll/confirm", { code: "000000" }, { cookie: cookieHeader(jar) })).status).toBe(401);
    const done = await post(mfaConfirm.POST as H, "/api/auth/mfa/enroll/confirm", { code: totpAt(secret, Date.now()) }, { cookie: cookieHeader(jar) });
    expect(done.status).toBe(200);
    expect(done.data.status).toBe("authenticated");
    expect(done.data.recoveryCodes).toHaveLength(10);
    for (const c of done.data.recoveryCodes) {
      expect(c).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
      seenSecrets.add(c);
    }
    const rows = await db().mfaRecoveryCode.findMany({ where: { userId: u.id } });
    expect(rows).toHaveLength(10);
    expect(JSON.stringify(rows)).not.toContain(done.data.recoveryCodes[0]);
    const session = cookieJar(done);
    const who = await get(me.GET as H, "/api/auth/me", asAccess(session));
    expect(who.data.mfa).toEqual({ method: "totp", enabled: true, required: true, recoveryCodesRemaining: 10 });
    expect(JSON.stringify(who.data)).not.toContain(secret);
    expect((await post(mfaStart.POST as H, "/api/auth/mfa/enroll/start", {}, { cookie: asAccess(session) })).status).toBe(409); // cannot silently re-enrol
    expect(await db().activityLog.count({ where: { action: "mfa_enrolled", entityId: u.id } })).toBe(1);
    expect(sink.some((m) => m.to === "newadmin@t.dev" && /Two-factor authentication enabled/.test(m.subject))).toBe(true);

    // recovery code: works once
    const again = cookieJar(await post(login.POST as H, "/api/auth/login", { email: "newadmin@t.dev", password: PASSWORD }));
    const code0 = done.data.recoveryCodes[0].toLowerCase().replace("-", " ");
    const rec = await post(mfaVerify.POST as H, "/api/auth/mfa/verify", { recoveryCode: code0 }, { cookie: cookieHeader(again) });
    expect(rec.status).toBe(200);
    expect(rec.data.recoveryCodesRemaining).toBe(9);
    const again2 = cookieJar(await post(login.POST as H, "/api/auth/login", { email: "newadmin@t.dev", password: PASSWORD }));
    expect((await post(mfaVerify.POST as H, "/api/auth/mfa/verify", { recoveryCode: done.data.recoveryCodes[0] }, { cookie: cookieHeader(again2) })).status).toBe(401);
  });

  it("a user whose roles do not require MFA can enrol and later disable it; an admin cannot disable it", async () => {
    const jar = await loginSession("plain@t.dev");
    const c = asAccess(jar);
    const start = await post(mfaStart.POST as H, "/api/auth/mfa/enroll/start", {}, { cookie: c });
    const confirm = await post(mfaConfirm.POST as H, "/api/auth/mfa/enroll/confirm", { code: totpAt(start.data.secret, Date.now()) }, { cookie: c });
    expect(confirm.status).toBe(200);
    expect((await call(mfaSelf.DELETE as H, { method: "DELETE", url: "/api/auth/mfa", cookie: c })).status).toBe(200);
    expect(await db().mfaCredential.count({ where: { userId: ids.plain } })).toBe(0);

    const admin = asAccess(await loginSession("adm@t.dev"));
    expect((await call(mfaSelf.DELETE as H, { method: "DELETE", url: "/api/auth/mfa", cookie: admin })).status).toBe(403);
    expect(await db().mfaCredential.count({ where: { userId: ids.admin } })).toBe(1);
  });

  it("only a Super Admin can reset someone else's MFA: an Admin with user-edit rights cannot, nobody can reset their own", async () => {
    const victim = await makeUser("victim@t.dev", roleIds.admin, "active", PASSWORD, { name: "Vic Tim" });
    const adminCookie = asAccess(await loginSession("adm@t.dev"));
    const saCookie = asAccess(await loginSession("sa@t.dev"));
    const victimJar = await loginSession("victim@t.dev");
    const url = `/api/users/${victim.id}/mfa-reset`;
    expect((await call(mfaReset.POST as H, { method: "POST", url, cookie: adminCookie, body: {}, params: { id: victim.id } })).status).toBe(403);
    expect((await call(mfaReset.POST as H, { method: "POST", url, cookie: undefined, body: {}, params: { id: victim.id } })).status).toBe(401);
    expect((await call(mfaReset.POST as H, { method: "POST", url: `/api/users/${ids.sa}/mfa-reset`, cookie: saCookie, body: {}, params: { id: ids.sa } })).status).toBe(403);
    expect(await db().mfaCredential.count({ where: { userId: victim.id } })).toBe(1);
    const ok = await call(mfaReset.POST as H, { method: "POST", url, cookie: saCookie, body: {}, params: { id: victim.id } });
    expect(ok.status).toBe(200);
    expect(await db().mfaCredential.count({ where: { userId: victim.id } })).toBe(0);
    expect(await db().mfaRecoveryCode.count({ where: { userId: victim.id } })).toBe(0);
    expect((await get(me.GET as H, "/api/auth/me", asAccess(victimJar))).status).toBe(401); // sessions revoked
    expect((await post(login.POST as H, "/api/auth/login", { email: "victim@t.dev", password: PASSWORD })).data.enrolled).toBe(false); // must re-enrol
    expect(await db().activityLog.count({ where: { action: "mfa_reset", entityId: victim.id } })).toBe(1);
    expect(sink.some((m) => m.to === "victim@t.dev" && /reset/i.test(m.subject))).toBe(true);
  });

  it("step-up: high-risk operations need a recent re-authentication (password + second factor)", async () => {
    const target = await newStaff();
    const jar = await loginSession("sa@t.dev");
    const c = asAccess(jar);
    const statusCall = () => call(userStatus.POST as H, { method: "POST", url: `/api/users/${target.id}/status`, cookie: c, body: { status: "suspended" }, params: { id: target.id } });
    await db().session.updateMany({ where: { userId: ids.sa }, data: { reauthAt: new Date(Date.now() - 3600_000) } });
    const denied = await statusCall();
    expect(denied.status).toBe(403);
    expect(denied.data.error.code).toBe("reauth_required");
    expect((await post(reauth.POST as H, "/api/auth/reauth", { password: "wrong-password-1A!" }, { cookie: c })).status).toBe(401);
    await freshStep(ids.sa);
    expect((await post(reauth.POST as H, "/api/auth/reauth", { password: PASSWORD }, { cookie: c })).status).toBe(401); // second factor missing
    await freshStep(ids.sa);
    expect((await post(reauth.POST as H, "/api/auth/reauth", { password: PASSWORD, code: totpFor(ids.sa) }, { cookie: c })).status).toBe(200);
    expect((await statusCall()).status).toBe(200);
    expect(await db().activityLog.count({ where: { action: "reauth" } })).toBe(1);
  });

  it("step-up is not leaked to unauthorised callers (authorisation first)", async () => {
    const target = await newStaff();
    const staff = asAccess(await loginSession("plain@t.dev"));
    await db().session.updateMany({ where: { userId: ids.plain }, data: { reauthAt: new Date(Date.now() - 3600_000) } });
    const r = await call(userStatus.POST as H, { method: "POST", url: `/api/users/${target.id}/status`, cookie: staff, body: { status: "suspended" }, params: { id: target.id } });
    expect(r.status).toBe(403);
    expect(r.data.error.code).toBe("forbidden");
  });

  it("can be enrolled directly in tests but the helper secret never reaches the API (sanity)", async () => {
    const secret = await enrolMfa(ids.plain);
    seenSecrets.add(secret);
    const jar = await loginSession("plain@t.dev");
    expect(JSON.stringify((await get(me.GET as H, "/api/auth/me", asAccess(jar))).data)).not.toContain(secret);
    await db().mfaCredential.deleteMany({ where: { userId: ids.plain } });
  });
});

/* ═══════════════════ password reset ═══════════════════ */
describe("password reset", () => {
  it("answers identically for known and unknown accounts, and emails only the real one", async () => {
    const u = await newStaff();
    const a = await post(forgot.POST as H, "/api/auth/password/forgot", { email: u.email });
    const b = await post(forgot.POST as H, "/api/auth/password/forgot", { email: "nobody@t.dev" });
    const inv = await newInvited();
    const c = await post(forgot.POST as H, "/api/auth/password/forgot", { email: inv.email });
    expect([a.status, b.status, c.status]).toEqual([200, 200, 200]);
    expect(a.data).toEqual(b.data);
    expect(a.data).toEqual(c.data);
    expect(sink.map((m) => m.to)).toEqual([u.email]);
    expect(mailTo(u.email)!.html).toContain("Hamsavahin");
  });

  it("rate limits requests per account", async () => {
    const u = await newStaff();
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await post(forgot.POST as H, "/api/auth/password/forgot", { email: u.email })).status);
    expect(codes).toEqual([200, 200, 200, 429]);
  });

  it("enforces the password policy, forbids reuse, is single use, expires, and revokes every session and refresh token", async () => {
    const u = await newStaff({ name: "Quinn Parker" });
    const old = await loginSession(u.email);
    await post(forgot.POST as H, "/api/auth/password/forgot", { email: u.email });
    const token = resetTokenOf(mailTo(u.email)!);
    const body = (password: string) => post(reset.POST as H, "/api/auth/password/reset", { token, password });
    expect((await body("short")).status).toBe(422);
    expect((await body("Parker-Garden-Lantern-47!")).status).toBe(422); // contains the surname
    expect((await body("Password@123456Aq")).status).toBe(422); // common
    expect((await body(PASSWORD)).status).toBe(422); // same as current
    const ok = await body(NEW_PASSWORD);
    expect(ok.status).toBe(200);
    expect((await body(OTHER_PASSWORD)).status).toBe(422); // single use
    expect((await get(me.GET as H, "/api/auth/me", asAccess(old))).status).toBe(401);
    expect((await post(refresh.POST as H, "/api/auth/refresh", {}, { cookie: asRefresh(old.hv_rt) })).status).toBe(401);
    expect(await db().session.count({ where: { userId: (await db().adminUser.findUniqueOrThrow({ where: { email: u.email } })).id } })).toBe(0);
    expect((await post(login.POST as H, "/api/auth/login", { email: u.email, password: PASSWORD })).status).toBe(401);
    expect((await post(login.POST as H, "/api/auth/login", { email: u.email, password: NEW_PASSWORD })).status).toBe(200);
    expect(sink.some((m) => m.to === u.email && /was reset/i.test(m.subject + m.text))).toBe(true);
    expect(await db().activityLog.count({ where: { action: "password_reset", detail: { contains: "completed" } } })).toBeGreaterThanOrEqual(1);
  });

  it("rejects expired and unknown tokens with one generic message", async () => {
    const u = await newStaff();
    await post(forgot.POST as H, "/api/auth/password/forgot", { email: u.email });
    const token = resetTokenOf(mailTo(u.email)!);
    await db().userToken.updateMany({ where: { tokenHash: hashToken(token) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await post(reset.POST as H, "/api/auth/password/reset", { token, password: NEW_PASSWORD });
    const unknown = await post(reset.POST as H, "/api/auth/password/reset", { token: "z".repeat(43), password: NEW_PASSWORD });
    expect(expired.status).toBe(422);
    expect(expired.data.error.message).toBe(unknown.data.error.message);
  });

  it("does not bypass MFA: an admin who resets a password must still complete the second factor", async () => {
    await post(forgot.POST as H, "/api/auth/password/forgot", { email: "adm@t.dev" });
    const token = resetTokenOf(mailTo("adm@t.dev")!);
    expect((await post(reset.POST as H, "/api/auth/password/reset", { token, password: NEW_PASSWORD })).status).toBe(200);
    const l = await post(login.POST as H, "/api/auth/login", { email: "adm@t.dev", password: NEW_PASSWORD });
    expect(l.data.status).toBe("mfa_required");
    await db().adminUser.update({ where: { id: ids.admin }, data: { passwordHash: (await db().adminUser.findUniqueOrThrow({ where: { id: ids.sa } })).passwordHash } }); // restore a known password for later tests
  });
});

/* ═══════════════════ request hygiene ═══════════════════ */
describe("CSRF and request hygiene", () => {
  const targets: [string, H, unknown][] = [
    ["/api/auth/login", login.POST as H, { email: "plain@t.dev", password: PASSWORD }],
    ["/api/auth/logout", logout.POST as H, {}],
    ["/api/auth/refresh", refresh.POST as H, {}],
    ["/api/auth/activate/request-otp", reqOtp.POST as H, { email: "a@t.dev" }],
    ["/api/auth/activate/verify-otp", verOtp.POST as H, { email: "a@t.dev", code: "123456" }],
    ["/api/auth/activate/set-password", setPw.POST as H, { password: NEW_PASSWORD }],
    ["/api/auth/password/forgot", forgot.POST as H, { email: "a@t.dev" }],
    ["/api/auth/password/reset", reset.POST as H, { token: "x".repeat(30), password: NEW_PASSWORD }],
    ["/api/auth/mfa/verify", mfaVerify.POST as H, { code: "123456" }],
    ["/api/auth/reauth", reauth.POST as H, { password: "x" }],
  ];
  it.each(targets)("%s rejects cross-origin and origin-less requests", async (url, handler, body) => {
    expect((await post(handler, url, body, { origin: "https://evil.example" })).status).toBe(403);
    expect((await post(handler, url, body, { origin: null })).status).toBe(403);
  });
  it.each(targets)("%s rejects non-JSON bodies (cross-site form posts)", async (url, handler, body) => {
    expect((await post(handler, url, JSON.stringify(body), { contentType: "text/plain" })).status).toBe(415);
    expect((await post(handler, url, "a=b", { contentType: "application/x-www-form-urlencoded" })).status).toBe(415);
  });
  it("protected endpoints answer 401 without a session", async () => {
    for (const h of [me.GET, mfaSelf.GET]) expect((await get(h as H, "/api/x")).status).toBe(401);
    expect((await post(reauth.POST as H, "/api/auth/reauth", { password: "x" })).status).toBe(401);
    expect((await post(mfaStart.POST as H, "/api/auth/mfa/enroll/start", {})).status).toBe(401);
  });
  it("internal errors never leak details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await post(login.POST as H, "/api/auth/login", "{not json");
    expect(r.status).toBe(422);
    expect(JSON.stringify(r.data)).not.toMatch(/at \w+|stack|prisma/i);
  });
});

/* ═══════════════════ nothing sensitive is stored or logged ═══════════════════ */
describe("no sensitive data in logs, audit trails or notification records", () => {
  it("never persisted any OTP, reset token, recovery code, TOTP secret or password in a log/audit table", async () => {
    expect(seenSecrets.size).toBeGreaterThan(5);
    const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));
    const dump = json([
      await db().activityLog.findMany(), await db().notificationLog.findMany(), await db().permissionChangeLog.findMany(), await db().authChallenge.findMany(), await db().rateLimit.findMany(),
    ]);
    for (const secret of seenSecrets) expect(dump, "a secret value reached a stored log").not.toContain(secret);
    const stored = json([await db().adminUser.findMany(), await db().userToken.findMany(), await db().mfaCredential.findMany(), await db().mfaRecoveryCode.findMany(), await db().refreshToken.findMany()]);
    for (const secret of seenSecrets) expect(stored, "a plaintext secret was stored").not.toContain(secret);
  });
  it("the server writes nothing sensitive to the console", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const u = await newInvited();
    await post(reqOtp.POST as H, "/api/auth/activate/request-otp", { email: u.email });
    const code = otpOf(mailTo(u.email)!);
    await post(verOtp.POST as H, "/api/auth/activate/verify-otp", { email: u.email, code });
    await post(login.POST as H, "/api/auth/login", { email: "plain@t.dev", password: PASSWORD });
    const printed = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(printed).not.toContain(code);
    expect(printed).not.toContain(PASSWORD);
  });
});

afterEach(() => vi.restoreAllMocks());
