import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import type { AddressInfo } from "node:net";
import { getDb } from "@/server/db";
import { getMailer, setMailer } from "@/server/mail";
import { getSmtpConfig } from "@/server/config";
import { issueUserToken } from "@/server/account";
import { nextEmployeeId } from "@/lib/authz/bootstrap";
import { call, ensurePermissions, makeRole } from "./helpers";
import * as reqOtp from "@/app/api/auth/activate/request-otp/route";
import * as forgot from "@/app/api/auth/password/forgot/route";

/**
 * End-to-end email delivery through a REAL SMTP conversation against a local sink (no external service, no credentials).
 * This proves the SMTP transport, the branded templates and that the code/link actually reach the mailbox; it does not
 * prove delivery by a real provider, which needs real credentials (see docs/authentication.md).
 */
type H = Parameters<typeof call>[0];
const inbox: { to: string; raw: string }[] = [];
let server: SMTPServer;
let requireAuth = false;
const saved: Record<string, string | undefined> = {};
const ENV = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "SMTP_REQUIRE_TLS"];

function start(): Promise<number> {
  server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"], // plaintext sink (like a local dev relay)
    allowInsecureAuth: true,
    onAuth(auth, _s, cb) {
      if (requireAuth && (auth.username !== "mailer" || auth.password !== "s3cret-for-test-only")) return cb(new Error("bad credentials"));
      cb(null, { user: auth.username });
    },
    onData(stream, session, cb) {
      const chunks: Buffer[] = [];
      stream.on("data", (c) => chunks.push(c));
      stream.on("end", () => {
        inbox.push({ to: session.envelope.rcptTo[0].address, raw: Buffer.concat(chunks).toString() });
        cb();
      });
    },
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.server.address() as AddressInfo).port)));
}

beforeAll(async () => {
  for (const k of ENV) saved[k] = process.env[k];
  const port = await start();
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = String(port);
  process.env.SMTP_SECURE = "false";
  process.env.SMTP_REQUIRE_TLS = "false";
  process.env.MAIL_FROM = "Hamsavahin <no-reply@hamsavahin.test>";
  setMailer(null); // use the real SMTP mailer
  await ensurePermissions();
  const d = getDb();
  await d.activityLog.deleteMany();
  await d.adminUser.deleteMany();
  await d.role.deleteMany();
});
afterAll(async () => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  setMailer(null);
  await new Promise<void>((r) => server.close(() => r()));
});

describe("minimal SMTP configuration", () => {
  const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM"];
  const withEnv = (env: Record<string, string | undefined>, fn: () => void) => {
    const old = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    for (const k of keys) delete process.env[k];
    Object.assign(process.env, env);
    try { fn(); } finally { for (const k of keys) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } }
  };
  it("needs only the account and its app password", () => {
    withEnv({ SMTP_USER: "me@gmail.com", SMTP_PASSWORD: "app-pass" }, () => {
      expect(getSmtpConfig()).toEqual({ host: "smtp.gmail.com", port: 465, secure: true, user: "me@gmail.com", password: "app-pass", from: "me@gmail.com" });
    });
  });
  it("lets another provider override host, port and sender", () => {
    withEnv({ SMTP_USER: "u", SMTP_PASSWORD: "p", SMTP_HOST: "smtp.example.com", SMTP_PORT: "587", MAIL_FROM: "Hamsavahin <no-reply@example.com>" }, () => {
      expect(getSmtpConfig()).toMatchObject({ host: "smtp.example.com", port: 587, secure: false, from: "Hamsavahin <no-reply@example.com>" });
    });
  });
  it("is off when nothing is set, and rejects a username without a password", () => {
    withEnv({}, () => expect(getSmtpConfig()).toBeNull());
    withEnv({ SMTP_USER: "me@gmail.com" }, () => expect(() => getSmtpConfig()).toThrow(/SMTP_PASSWORD/));
    withEnv({ SMTP_HOST: "h", SMTP_PORT: "abc", MAIL_FROM: "a@b.c" }, () => expect(() => getSmtpConfig()).toThrow(/SMTP_PORT/));
  });
});

describe("SMTP delivery against a local sink", () => {
  it("delivers a branded OTP email containing the real code, from the configured sender", async () => {
    const d = getDb();
    const role = await makeRole("Staff", {});
    const u = await d.adminUser.create({ data: { employeeId: await nextEmployeeId(d), email: "mail.target@t.dev", name: "Mia Target", status: "invited", roles: { create: [{ roleId: role.id }] } } });
    await issueUserToken(d, u.id, "invite");
    const r = await call(reqOtp.POST as H, { method: "POST", url: "/api/auth/activate/request-otp", body: { email: "mail.target@t.dev" } });
    expect(r.status).toBe(200);
    expect(inbox).toHaveLength(1);
    const parsed = await simpleParser(inbox[0].raw);
    expect(parsed.from?.text).toContain("no-reply@hamsavahin.test");
    expect(parsed.to).toBeTruthy();
    expect(parsed.subject).toMatch(/verification code/i);
    const code = /(\d{3}) (\d{3})/.exec(parsed.text ?? "")!;
    expect(code).not.toBeNull();
    expect(parsed.html).toContain("Hamsavahin");
    expect(parsed.html).toContain(`${code[1]} ${code[2]}`);
    // the delivered code is the one the server will accept
    const challenge = await d.authChallenge.findFirstOrThrow({ where: { userId: u.id } });
    expect(challenge.codeDigest).toMatch(/^[0-9a-f]{64}$/);
    const log = await d.notificationLog.findFirstOrThrow({ where: { recipient: "mail.target@t.dev" } });
    expect(log.status).toBe("sent");
    expect(JSON.stringify(log)).not.toContain(code[1] + code[2]);
  });

  it("delivers the password-reset link", async () => {
    const d = getDb();
    const role = await d.role.findFirstOrThrow();
    const hash = (await d.adminUser.findFirstOrThrow()).passwordHash;
    await d.adminUser.create({ data: { employeeId: await nextEmployeeId(d), email: "reset.target@t.dev", name: "Rex Target", status: "active", passwordHash: hash ?? "x", roles: { create: [{ roleId: role.id }] } } });
    inbox.length = 0;
    await call(forgot.POST as H, { method: "POST", url: "/api/auth/password/forgot", body: { email: "reset.target@t.dev" } });
    expect(inbox).toHaveLength(1);
    const parsed = await simpleParser(inbox[0].raw);
    expect(parsed.text).toMatch(/\/admin\/reset-password\?token=/);
    expect(parsed.html).toContain("Choose a new password");
  });

  it("reports failure honestly (no pretending) when the server is unreachable", async () => {
    process.env.SMTP_PORT = "1"; // nothing listens here
    setMailer(null);
    const r = await getMailer().send({ to: "x@t.dev", subject: "s", text: "t" });
    expect(r.delivered).toBe(false);
    expect(r.error).toMatch(/SMTP delivery failed/);
    process.env.SMTP_PORT = String((server.server.address() as AddressInfo).port);
    setMailer(null);
  });

  it("refuses to send over an unencrypted connection unless that is explicitly allowed (STARTTLS required by default)", async () => {
    process.env.SMTP_REQUIRE_TLS = "true";
    setMailer(null);
    const r = await getMailer().send({ to: "x@t.dev", subject: "s", text: "t" });
    expect(r.delivered).toBe(false);
    process.env.SMTP_REQUIRE_TLS = "false";
    setMailer(null);
  });

  it("authenticates with configured credentials and fails with wrong ones", async () => {
    requireAuth = true;
    process.env.SMTP_USER = "mailer";
    process.env.SMTP_PASSWORD = "wrong";
    setMailer(null);
    expect((await getMailer().send({ to: "x@t.dev", subject: "s", text: "t" })).delivered).toBe(false);
    process.env.SMTP_PASSWORD = "s3cret-for-test-only";
    setMailer(null);
    expect((await getMailer().send({ to: "x@t.dev", subject: "s", text: "t" })).delivered).toBe(true);
    requireAuth = false;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    setMailer(null);
  });

  it("reports not-configured when SMTP_HOST is absent", async () => {
    delete process.env.SMTP_HOST;
    setMailer(null);
    const r = await getMailer().send({ to: "x@t.dev", subject: "s", text: "t" });
    expect(r).toEqual({ delivered: false, error: "Email delivery is not configured" });
    process.env.SMTP_HOST = "127.0.0.1";
    setMailer(null);
  });
});
