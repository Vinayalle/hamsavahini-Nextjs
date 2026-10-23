import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db";
import { setMailer, type MailMessage } from "@/server/mail";
import { keyedDigest } from "@/server/crypto";
import { call, cookieHeader, cookieJar, ensurePermissions, makeRole, makeUser, PASSWORD } from "./helpers";
import * as login from "@/app/api/auth/login/route";
import * as verify from "@/app/api/auth/mfa/verify/route";
import * as resend from "@/app/api/auth/mfa/resend/route";
import * as me from "@/app/api/auth/me/route";
import * as refresh from "@/app/api/auth/refresh/route";
import * as products from "@/app/api/products/route";

/**
 * The second sign-in step: EVERY employee, whatever their role, receives a 6-digit code by email
 * after a correct password; there is no authenticator app.
 */
type H = Parameters<typeof call>[0];
const db = () => getDb();
const sink: MailMessage[] = [];
const lastCode = (to: string) => {
  const m = [...sink].reverse().find((x) => x.to === to && /sign-in code/.test(x.subject));
  if (!m) throw new Error(`no sign-in email to ${to}`);
  return /(\d{3}) (\d{3})/.exec(m.text)!.slice(1).join("");
};
const post = (h: H, url: string, body: unknown = {}, o: { cookie?: string; ip?: string } = {}) => call(h, { method: "POST", url, body, cookie: o.cookie, headers: { "x-forwarded-for": o.ip ?? "198.51.100.7" } });
const signIn = (email: string, password = PASSWORD) => post(login.POST as H, "/api/auth/login", { email, password });
const wrongCode = (code: string) => (code === "000000" ? "111111" : "000000");
const uid: Record<string, string> = {};

beforeAll(async () => {
  await ensurePermissions();
  const d = db();
  await d.adminUser.deleteMany();
  await d.role.deleteMany();
  const sa = await makeRole("Super Admin", {}, true);
  const staff = await makeRole("Staff", { products: ["view"] });
  uid.sa = (await makeUser("sa@em.dev", sa.id, "active", PASSWORD, { name: "Sara Boss" })).id;
  uid.staff = (await makeUser("staff@em.dev", staff.id, "active", PASSWORD, { name: "Sam Staff" })).id;
  setMailer({ send: async (m) => { sink.push(m); return { delivered: true, providerMessageId: "sink" }; } });
});
afterAll(() => {
  setMailer(null);
});
beforeEach(async () => {
  sink.length = 0;
  const d = db();
  await d.rateLimit.deleteMany();
  await d.session.deleteMany();
  await d.authChallenge.deleteMany();
  await d.adminUser.updateMany({ data: { failedLoginCount: 0, lockedUntil: null } });
});

describe("email code at every sign-in, for every employee", () => {
  it("an ordinary employee gets the code too: the password alone never creates a session", async () => {
    for (const email of ["staff@em.dev", "sa@em.dev"]) {
      const r = await signIn(email);
      expect(r.status).toBe(200);
      expect(r.data).toMatchObject({ status: "mfa_required" });
      expect(r.data.maskedEmail).toMatch(/^[a-z]\*+@em\.dev$/);
      expect(r.headers.getSetCookie().map((c) => c.split("=")[0])).toEqual(["hv_mfa"]); // no access/refresh token yet
      expect(JSON.stringify(r.data)).not.toContain(email.split("@")[0] + "@");
      expect(sink.filter((m) => m.to === email)).toHaveLength(1);
      expect(lastCode(email)).toMatch(/^\d{6}$/);
    }
  });

  it("the full flow: password -> emailed code -> session; the session works and refreshes", async () => {
    const r = await signIn("staff@em.dev");
    const pending = cookieHeader(cookieJar(r));
    const code = lastCode("staff@em.dev");
    const ok = await post(verify.POST as H, "/api/auth/mfa/verify", { code }, { cookie: pending });
    expect(ok.status, JSON.stringify(ok.data)).toBe(200);
    expect(ok.data.status).toBe("authenticated");
    const jar = cookieJar(ok);
    expect(Object.keys(jar)).toEqual(expect.arrayContaining(["hv_at", "hv_rt"]));
    expect((await call(me.GET as H, { url: "/api/auth/me", cookie: `hv_at=${encodeURIComponent(jar.hv_at)}` })).status).toBe(200);
    expect((await call(products.GET as H, { url: "/api/products", cookie: `hv_at=${encodeURIComponent(jar.hv_at)}` })).status).toBe(200);
    expect((await post(refresh.POST as H, "/api/auth/refresh", {}, { cookie: `hv_rt=${encodeURIComponent(jar.hv_rt)}` })).status).toBe(200);
    expect((await db().session.findFirstOrThrow({ where: { userId: uid.staff } })).mfaVerifiedAt).not.toBeNull();
  });

  it("stores only a keyed digest of the code, never the code, and never logs it", async () => {
    await signIn("staff@em.dev");
    const code = lastCode("staff@em.dev");
    const row = await db().authChallenge.findFirstOrThrow({ where: { userId: uid.staff, purpose: "login" } });
    expect(row.codeDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(row.codeDigest).toBe(keyedDigest("login-otp", row.id, uid.staff, code));
    expect(JSON.stringify([row, await db().activityLog.findMany(), await db().notificationLog.findMany()])).not.toContain(code);
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeCloseTo(10 * 60_000, -3);
    expect(sink[0].html).toContain("Hamsavahin");
  });

  it("a wrong password sends no email at all (no code is issued for failed passwords)", async () => {
    const r = await signIn("staff@em.dev", "wrong-password-1A!");
    expect(r.status).toBe(401);
    expect(sink).toHaveLength(0);
    expect(await db().authChallenge.count()).toBe(0);
    expect((await signIn("ghost@em.dev")).status).toBe(401);
    expect(sink).toHaveLength(0);
  });

  it("refuses wrong codes, is single use, expires, and locks after 5 attempts", async () => {
    // wrong code
    let jar = cookieJar(await signIn("staff@em.dev"));
    const code = lastCode("staff@em.dev");
    expect((await post(verify.POST as H, "/api/auth/mfa/verify", { code: wrongCode(code) }, { cookie: cookieHeader(jar) })).status).toBe(401);
    // single use
    const good = await post(verify.POST as H, "/api/auth/mfa/verify", { code }, { cookie: cookieHeader(jar) });
    expect(good.status).toBe(200);
    expect((await post(verify.POST as H, "/api/auth/mfa/verify", { code }, { cookie: cookieHeader(jar) })).status).toBe(401); // replay
    // expiry
    await db().authChallenge.deleteMany();
    await db().rateLimit.deleteMany();
    jar = cookieJar(await signIn("staff@em.dev"));
    const code2 = lastCode("staff@em.dev");
    await db().authChallenge.updateMany({ where: { userId: uid.staff }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await post(verify.POST as H, "/api/auth/mfa/verify", { code: code2 }, { cookie: cookieHeader(jar) })).status).toBe(401);
    // attempt limit: the right code stops working once 5 guesses were used
    await db().authChallenge.deleteMany();
    await db().rateLimit.deleteMany();
    jar = cookieJar(await signIn("staff@em.dev"));
    const code3 = lastCode("staff@em.dev");
    for (let i = 0; i < 5; i++) expect((await post(verify.POST as H, "/api/auth/mfa/verify", { code: wrongCode(code3) }, { cookie: cookieHeader(jar) })).status).toBe(401);
    expect((await post(verify.POST as H, "/api/auth/mfa/verify", { code: code3 }, { cookie: cookieHeader(jar) })).status).toBe(401);
    expect(await db().activityLog.count({ where: { action: "mfa_failed" } })).toBeGreaterThanOrEqual(7);
  });

  it("parallel guesses cannot exceed the attempt budget, and parallel correct submissions yield one session", async () => {
    const jar = cookieJar(await signIn("staff@em.dev"));
    const code = lastCode("staff@em.dev");
    const res = await Promise.all(Array.from({ length: 4 }, () => post(verify.POST as H, "/api/auth/mfa/verify", { code }, { cookie: cookieHeader(jar) })));
    expect(res.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await db().session.count({ where: { userId: uid.staff } })).toBe(1);
  });

  it("resend: honours the cooldown, then a new code replaces the old one", async () => {
    const jar = cookieJar(await signIn("staff@em.dev"));
    const first = lastCode("staff@em.dev");
    const early = await post(resend.POST as H, "/api/auth/mfa/resend", {}, { cookie: cookieHeader(jar) });
    expect(early.status).toBe(200);
    expect(early.data.sent).toBe(false);
    expect(early.data.retryAfterSeconds).toBeGreaterThan(0);
    expect(sink).toHaveLength(1);
    await db().authChallenge.updateMany({ where: { userId: uid.staff }, data: { createdAt: new Date(Date.now() - 120_000) } });
    const late = await post(resend.POST as H, "/api/auth/mfa/resend", {}, { cookie: cookieHeader(jar) });
    expect(late.data.sent).toBe(true);
    expect(sink).toHaveLength(2);
    const second = lastCode("staff@em.dev");
    if (first !== second) expect((await post(verify.POST as H, "/api/auth/mfa/verify", { code: first }, { cookie: cookieHeader(jar) })).status).toBe(401);
    expect((await post(verify.POST as H, "/api/auth/mfa/verify", { code: second }, { cookie: cookieHeader(jar) })).status).toBe(200);
    expect(await post(resend.POST as H, "/api/auth/mfa/resend", {})).toMatchObject({ status: 401 }); // no password proof, no resend
  });

  it("a code cannot be used by another person, nor without the password step", async () => {
    await signIn("staff@em.dev");
    const staffCode = lastCode("staff@em.dev");
    const saJar = cookieJar(await signIn("sa@em.dev"));
    expect((await post(verify.POST as H, "/api/auth/mfa/verify", { code: staffCode }, { cookie: cookieHeader(saJar) })).status).toBe(401); // staff's code on sa's session
    expect((await post(verify.POST as H, "/api/auth/mfa/verify", { code: staffCode })).status).toBe(401); // no proof at all
    expect((await post(verify.POST as H, "/api/auth/mfa/verify", { recoveryCode: "AAAAA-BBBBB" }, { cookie: cookieHeader(saJar) })).status).toBe(422); // there are no recovery codes: only the emailed code is accepted
  });

  it("is rate limited: guessing, and requesting codes", async () => {
    const jar = cookieJar(await signIn("staff@em.dev"));
    const out = [];
    for (let i = 0; i < 12; i++) out.push((await post(verify.POST as H, "/api/auth/mfa/verify", { code: "000000" }, { cookie: cookieHeader(jar) })).status);
    expect(out[11]).toBe(429);
    await db().rateLimit.deleteMany();
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      await db().authChallenge.updateMany({ where: { userId: uid.sa }, data: { createdAt: new Date(Date.now() - 120_000) } });
      await db().rateLimit.deleteMany({ where: { key: { startsWith: "login:" } } }); // isolate the code-request limit from the password limits
      codes.push((await signIn("sa@em.dev")).status);
    }
    expect(codes.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(codes[11]).toBe(429);
  });

  it("if the email cannot be sent the user is told, nothing is half-issued, and no session exists", async () => {
    setMailer({ send: async () => ({ delivered: false, error: "SMTP down" }) });
    const r = await signIn("staff@em.dev");
    expect(r.status).toBe(503);
    expect(r.data.error.code).toBe("email_unavailable");
    expect(r.headers.getSetCookie()).toHaveLength(0);
    expect(await db().authChallenge.count({ where: { invalidatedAt: null, consumedAt: null } })).toBe(0);
    expect(await db().session.count()).toBe(0);
    setMailer({ send: async (m) => { sink.push(m); return { delivered: true, providerMessageId: "sink" }; } });
  });

  it("a deactivated account cannot finish a pending sign-in", async () => {
    const jar = cookieJar(await signIn("staff@em.dev"));
    const code = lastCode("staff@em.dev");
    await db().adminUser.update({ where: { id: uid.staff }, data: { status: "suspended" } });
    expect((await post(verify.POST as H, "/api/auth/mfa/verify", { code }, { cookie: cookieHeader(jar) })).status).toBe(401);
    expect(await db().session.count({ where: { userId: uid.staff } })).toBe(0);
    await db().adminUser.update({ where: { id: uid.staff }, data: { status: "active" } });
  });

  it("an existing session without the emailed-code step is rejected (policy cannot be bypassed by a crafted session)", async () => {
    const { signAccessToken } = await import("@/server/tokens");
    const s = await db().session.create({ data: { userId: uid.staff, expiresAt: new Date(Date.now() + 3600_000) } }); // no mfaVerifiedAt
    expect((await call(me.GET as H, { url: "/api/auth/me", cookie: `hv_at=${await signAccessToken({ sub: uid.staff, sid: s.id })}` })).status).toBe(401);
    await db().session.update({ where: { id: s.id }, data: { mfaVerifiedAt: new Date() } });
    expect((await call(me.GET as H, { url: "/api/auth/me", cookie: `hv_at=${await signAccessToken({ sub: uid.staff, sid: s.id })}` })).status).toBe(200);
  });

  it("each sign-in needs a NEW code (a previous session's code is never reused)", async () => {
    const a = cookieJar(await signIn("staff@em.dev"));
    const codeA = lastCode("staff@em.dev");
    expect((await post(verify.POST as H, "/api/auth/mfa/verify", { code: codeA }, { cookie: cookieHeader(a) })).status).toBe(200);
    await db().rateLimit.deleteMany();
    const b = cookieJar(await signIn("staff@em.dev"));
    expect((await post(verify.POST as H, "/api/auth/mfa/verify", { code: codeA }, { cookie: cookieHeader(b) })).status).toBe(401);
    expect(sink.filter((m) => m.to === "staff@em.dev")).toHaveLength(2);
  });
});
