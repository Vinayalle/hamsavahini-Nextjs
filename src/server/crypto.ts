import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { getAuthConfig } from "./config";

/* Random values ------------------------------------------------------------------------------------------------- */

/** 256-bit opaque random token (refresh tokens, grants, links). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Uniformly random numeric code (no modulo bias). */
export function randomDigits(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) out += String(randomInt(0, 10));
  return out;
}

/* Keyed digests (HMAC-SHA256 with the server-side pepper) ------------------------------------------------------- */

/**
 * Domain-separated keyed digest. A database leak alone cannot be used to brute-force a 6-digit OTP offline,
 * because the pepper lives in the environment, not in the database.
 */
export function keyedDigest(purpose: string, ...parts: string[]): string {
  return createHmac("sha256", getAuthConfig().otpPepper).update(`${purpose}\u0000${parts.join("\u0000")}`).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/* AES-256-GCM for reversible secrets (TOTP seeds) ----------------------------------------------------------------- */

const VERSION = "v1";

/** Output: v1.<iv>.<tag>.<ciphertext>, all base64url. A fresh random 96-bit IV per message; `aad` binds it to its owner. */
export function encryptSecret(plain: string, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getAuthConfig().encryptionKey, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(payload: string, aad: string): string {
  const [v, iv, tag, ct] = payload.split(".");
  if (v !== VERSION || !iv || !tag || !ct) throw new Error("Unsupported ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", getAuthConfig().encryptionKey, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
