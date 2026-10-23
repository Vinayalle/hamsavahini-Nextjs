import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
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
