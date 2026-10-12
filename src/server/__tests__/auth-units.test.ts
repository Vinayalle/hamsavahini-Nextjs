import { afterEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { hash } from "@node-rs/argon2";
import { getAuthConfig, resetAuthConfigForTests } from "@/server/config";
import { decryptSecret, encryptSecret, keyedDigest, randomDigits, randomToken, safeEqualHex } from "@/server/crypto";
import { signAccessToken, signPendingMfaToken, verifyAccessToken, verifyPendingMfaToken } from "@/server/tokens";
import { hashPassword, passwordNeedsRehash, verifyPassword } from "@/server/security";
import { base32Decode, base32Encode, hotp, matchTotp, otpauthUri, stepAt, totpAt } from "@/server/totp";
import { lockDurationMs } from "@/server/auth";

const ENV_KEYS = ["AUTH_JWT_SECRET", "AUTH_OTP_PEPPER", "AUTH_ENCRYPTION_KEY", "AUTH_ARGON_MEMORY_KIB", "AUTH_ARGON_TIME_COST", "NODE_ENV"] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const env = process.env as Record<string, string | undefined>;
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete env[k];
    else env[k] = saved[k];
  }
  resetAuthConfigForTests();
});

/* ───────────────────────── TOTP (RFC 6238 / RFC 4226) ───────────────────────── */
describe("TOTP", () => {
  // RFC 6238 Appendix B, SHA-1 secret "12345678901234567890"
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ])("matches the RFC 6238 test vector at t=%i", (t, expected) => {
    expect(totpAt(secret, t * 1000, 8)).toBe(expected);
  });
  it("matches the RFC 4226 HOTP vectors", () => {
    const key = Buffer.from("12345678901234567890");
    expect([0, 1, 2, 3].map((c) => hotp(key, c))).toEqual(["755224", "287082", "359152", "969429"]);
  });
  it("base32 round-trips", () => {
    for (const n of [1, 5, 10, 20, 33]) {
      const buf = Buffer.from(Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256));
      expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    }
  });
  it("accepts the current step and one step of drift, nothing further", () => {
    const now = 1_700_000_000_000;
    const step = stepAt(now);
    expect(matchTotp(secret, totpAt(secret, now), now)).toBe(step);
    expect(matchTotp(secret, totpAt(secret, now - 30_000), now)).toBe(step - 1);
    expect(matchTotp(secret, totpAt(secret, now + 30_000), now)).toBe(step + 1);
    expect(matchTotp(secret, totpAt(secret, now - 90_000), now)).toBeNull();
    expect(matchTotp(secret, totpAt(secret, now + 90_000), now)).toBeNull();
  });
  it("rejects malformed codes", () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12 3456", "١٢٣٤٥٦"]) expect(matchTotp(secret, bad, Date.now())).toBeNull();
  });
  it("builds an otpauth URI without the account password and with the issuer", () => {
    const uri = otpauthUri("JBSWY3DPEHPK3PXP", "a@b.co", "Hamsavahin Admin");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=Hamsavahin%20Admin");
  });
});

/* ───────────────────────── encryption + keyed digests ───────────────────────── */
describe("AES-256-GCM and keyed digests", () => {
  it("round-trips and uses a fresh IV every time", () => {
    const a = encryptSecret("JBSWY3DPEHPK3PXP", "user-1");
    const b = encryptSecret("JBSWY3DPEHPK3PXP", "user-1");
    expect(a).not.toBe(b);
    expect(a).not.toContain("JBSWY3DPEHPK3PXP");
    expect(a.startsWith("v1.")).toBe(true);
    expect(decryptSecret(a, "user-1")).toBe("JBSWY3DPEHPK3PXP");
  });
  it("detects tampering and a wrong owner (authenticated encryption)", () => {
    const enc = encryptSecret("top-secret", "user-1");
    const parts = enc.split(".");
    const flipped = [...parts.slice(0, 3), Buffer.from(Buffer.from(parts[3], "base64url").map((b, i) => (i === 0 ? b ^ 1 : b))).toString("base64url")].join(".");
    expect(() => decryptSecret(flipped, "user-1")).toThrow();
    expect(() => decryptSecret(enc, "user-2")).toThrow();
    expect(() => decryptSecret("v9.a.b.c", "user-1")).toThrow();
  });
  it("cannot be decrypted with a different key", () => {
    const enc = encryptSecret("top-secret", "u");
    env.AUTH_ENCRYPTION_KEY = randomToken(32);
    resetAuthConfigForTests();
    expect(() => decryptSecret(enc, "u")).toThrow();
  });
  it("keyed digests are deterministic, domain-separated and depend on the pepper", () => {
    expect(keyedDigest("otp", "a", "123456")).toBe(keyedDigest("otp", "a", "123456"));
    expect(keyedDigest("otp", "a", "123456")).not.toBe(keyedDigest("recovery", "a", "123456"));
    expect(keyedDigest("otp", "a", "123456")).not.toBe(keyedDigest("otp", "b", "123456"));
    const before = keyedDigest("otp", "a", "123456");
    env.AUTH_OTP_PEPPER = randomToken(32);
    resetAuthConfigForTests();
    expect(keyedDigest("otp", "a", "123456")).not.toBe(before);
    expect(safeEqualHex(before, before)).toBe(true);
    expect(safeEqualHex(before, "00")).toBe(false);
  });
  it("generates unbiased-looking numeric codes and long random tokens", () => {
    const codes = Array.from({ length: 300 }, () => randomDigits(6));
    expect(codes.every((c) => /^\d{6}$/.test(c))).toBe(true);
    expect(new Set(codes).size).toBeGreaterThan(280);
    expect(randomToken().length).toBeGreaterThanOrEqual(43);
    expect(new Set(Array.from({ length: 50 }, () => randomToken())).size).toBe(50);
  });
});

/* ───────────────────────── JWT ───────────────────────── */
describe("JWT access tokens", () => {
  const claims = { sub: "11111111-1111-4111-8111-111111111111", sid: "22222222-2222-4222-8222-222222222222" };
  const forge = (secret: Uint8Array, patch: (j: SignJWT) => SignJWT, alg = "HS256") => {
    const c = getAuthConfig();
    return patch(new SignJWT({ ...claims, use: "access" }).setProtectedHeader({ alg }).setIssuer(c.issuer).setAudience(c.audience).setSubject(claims.sub).setIssuedAt().setJti("j").setExpirationTime("5m")).sign(secret);
  };

  it("round-trips and carries identity only (no email, roles or permissions)", async () => {
    const token = await signAccessToken(claims);
    expect(await verifyAccessToken(token)).toEqual(claims);
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    expect(Object.keys(payload).sort()).toEqual(["aud", "exp", "iat", "iss", "jti", "sid", "sub", "use"]);
    expect(JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString()).alg).toBe("HS256");
  });
  it("rejects a token signed with another secret", async () => {
    const token = await forge(new Uint8Array(32).fill(7), (j) => j);
    expect(await verifyAccessToken(token)).toBeNull();
  });
  it("rejects tampered payloads", async () => {
    const [h, p, s] = (await signAccessToken(claims)).split(".");
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    payload.sub = "33333333-3333-4333-8333-333333333333";
    expect(await verifyAccessToken([h, Buffer.from(JSON.stringify(payload)).toString("base64url"), s].join("."))).toBeNull();
  });
  it('rejects "alg: none" and unsigned tokens', async () => {
    const c = getAuthConfig();
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ ...claims, use: "access", iss: c.issuer, aud: c.audience, exp: Math.floor(Date.now() / 1000) + 600, iat: 1, jti: "x" })).toString("base64url");
    expect(await verifyAccessToken(`${header}.${body}.`)).toBeNull();
  });
  it("rejects other HMAC algorithms (algorithm pinning)", async () => {
    expect(await verifyAccessToken(await forge(getAuthConfig().jwtSecret, (j) => j, "HS512"))).toBeNull();
  });
  it("rejects expired tokens", async () => {
    const token = await forge(getAuthConfig().jwtSecret, (j) => j.setExpirationTime(Math.floor(Date.now() / 1000) - 60));
    expect(await verifyAccessToken(token)).toBeNull();
  });
  it("rejects a wrong issuer and a wrong audience", async () => {
    expect(await verifyAccessToken(await forge(getAuthConfig().jwtSecret, (j) => j.setIssuer("someone-else")))).toBeNull();
    expect(await verifyAccessToken(await forge(getAuthConfig().jwtSecret, (j) => j.setAudience("another-api")))).toBeNull();
  });
  it("rejects tokens missing required claims", async () => {
    const c = getAuthConfig();
    const noSid = await new SignJWT({ use: "access" }).setProtectedHeader({ alg: "HS256" }).setIssuer(c.issuer).setAudience(c.audience).setSubject(claims.sub).setIssuedAt().setJti("j").setExpirationTime("5m").sign(c.jwtSecret);
    expect(await verifyAccessToken(noSid)).toBeNull();
    const noJti = await new SignJWT({ ...claims, use: "access" }).setProtectedHeader({ alg: "HS256" }).setIssuer(c.issuer).setAudience(c.audience).setSubject(claims.sub).setIssuedAt().setExpirationTime("5m").sign(c.jwtSecret);
    expect(await verifyAccessToken(noJti)).toBeNull();
  });
  it("a pending-MFA token can never be used as an access token, nor the reverse", async () => {
    const pending = await signPendingMfaToken({ sub: claims.sub });
    expect(await verifyAccessToken(pending)).toBeNull();
    expect(await verifyPendingMfaToken(pending)).toEqual({ sub: claims.sub });
    expect(await verifyPendingMfaToken(await signAccessToken(claims))).toBeNull();
  });
  it("rejects garbage", async () => {
    for (const bad of ["", "abc", "a.b.c", "....", "x".repeat(500)]) expect(await verifyAccessToken(bad)).toBeNull();
  });
});

/* ───────────────────────── configuration ───────────────────────── */
describe("configuration validation", () => {
  const set = (k: (typeof ENV_KEYS)[number], v: string | undefined) => {
    if (v === undefined) delete env[k];
    else env[k] = v;
    resetAuthConfigForTests();
  };
  it("refuses to start without secrets and names the variable, never a value", () => {
    set("AUTH_JWT_SECRET", undefined);
    expect(() => getAuthConfig()).toThrow(/AUTH_JWT_SECRET is not set/);
  });
  it("rejects short, placeholder and low-entropy secrets without echoing them", () => {
    for (const bad of ["short", "change-me-change-me-change-me-change-me", "A".repeat(64), "replace_this_with_something"]) {
      set("AUTH_JWT_SECRET", bad);
      let message = "";
      try {
        getAuthConfig();
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toMatch(/AUTH_JWT_SECRET/);
      expect(message).not.toContain(bad);
    }
  });
  it("requires an exactly 32-byte encryption key", () => {
    set("AUTH_ENCRYPTION_KEY", randomToken(16));
    expect(() => getAuthConfig()).toThrow(/exactly 32/);
    set("AUTH_ENCRYPTION_KEY", randomToken(48));
    expect(() => getAuthConfig()).toThrow(/exactly 32/);
  });
  it("requires the three secrets to be different", () => {
    const same = randomToken(32);
    set("AUTH_OTP_PEPPER", same);
    set("AUTH_JWT_SECRET", same);
    expect(() => getAuthConfig()).toThrow(/three different/);
  });
  it("uses the 64 MiB / 3 pass / 1 lane Argon2id parameters in production regardless of overrides", () => {
    delete env.AUTH_ARGON_MEMORY_KIB;
    delete env.AUTH_ARGON_TIME_COST;
    set("NODE_ENV", "production");
    expect(getAuthConfig().argon).toEqual({ memoryCost: 65536, timeCost: 3, parallelism: 1 });
    expect(getAuthConfig().secureCookies).toBe(true);
    env.AUTH_ARGON_MEMORY_KIB = "1024"; // too weak for production: refused, not silently accepted
    resetAuthConfigForTests();
    expect(() => getAuthConfig()).toThrow(/AUTH_ARGON_MEMORY_KIB/);
  });
});

/* ───────────────────────── password hashing ───────────────────────── */
describe("Argon2id password hashing", () => {
  it("produces argon2id hashes with the configured parameters and verifies correctly", async () => {
    const h = await hashPassword("Vast-Orchid-Lantern-47!");
    expect(h).toMatch(/^\$argon2id\$v=19\$m=1024,t=2,p=1\$/);
    expect(await verifyPassword(h, "Vast-Orchid-Lantern-47!")).toBe(true);
    expect(await verifyPassword(h, "Vast-Orchid-Lantern-48!")).toBe(false);
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
    expect(h).not.toContain("Vast-Orchid");
  });
  it("salts every hash", async () => {
    expect(await hashPassword("Vast-Orchid-Lantern-47!")).not.toBe(await hashPassword("Vast-Orchid-Lantern-47!"));
  });
  it("flags hashes with outdated parameters or another algorithm for rehash", async () => {
    expect(passwordNeedsRehash(await hashPassword("Vast-Orchid-Lantern-47!"))).toBe(false);
    expect(passwordNeedsRehash(await hash("pw-pw-pw-pw", { memoryCost: 512, timeCost: 1, parallelism: 1 }))).toBe(true);
    // each parameter is checked on its own
    expect(passwordNeedsRehash(await hash("pw-pw-pw-pw", { memoryCost: 512, timeCost: 2, parallelism: 1 }))).toBe(true); // memory only
    expect(passwordNeedsRehash(await hash("pw-pw-pw-pw", { memoryCost: 1024, timeCost: 1, parallelism: 1 }))).toBe(true); // passes only
    expect(passwordNeedsRehash("$2b$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz0123")).toBe(true);
    expect(passwordNeedsRehash("garbage")).toBe(true);
  });
});

describe("progressive lockout", () => {
  it("starts at five failures, doubles, and is capped (never permanent)", () => {
    expect([1, 2, 3, 4].map(lockDurationMs)).toEqual([0, 0, 0, 0]);
    expect(lockDurationMs(5)).toBe(60_000);
    expect(lockDurationMs(6)).toBe(120_000);
    expect(lockDurationMs(7)).toBe(240_000);
    expect(lockDurationMs(100)).toBe(30 * 60_000);
  });
});
