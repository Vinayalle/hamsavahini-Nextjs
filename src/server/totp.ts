import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP (RFC 6238) on HOTP (RFC 4226): HMAC-SHA1, 30-second steps, 6 digits. This is what every authenticator app
 * (Google Authenticator, Microsoft Authenticator, Authy, 1Password ...) implements. No server secrets here: pure functions.
 */
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160-bit random shared secret, base32 (the form authenticator apps accept). */
export const generateTotpSecret = () => base32Encode(randomBytes(20));

export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const offset = h[h.length - 1] & 0xf;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const stepAt = (timeMs: number) => Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);

export function totpAt(secretBase32: string, timeMs: number, digits = TOTP_DIGITS): string {
  return hotp(base32Decode(secretBase32), stepAt(timeMs), digits);
}

/**
 * Returns the time-step the code belongs to, or null. Accepts +/- `window` steps for clock drift. The caller must then
 * refuse any step <= the last accepted one (replay protection), done atomically in the database.
 */
export function matchTotp(secretBase32: string, code: string, timeMs: number, window = 1): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const now = stepAt(timeMs);
  let matched: number | null = null;
  // Check every step (no early exit) so timing does not reveal which one matched.
  for (let w = -window; w <= window; w++) {
    const expected = Buffer.from(hotp(secret, now + w));
    const given = Buffer.from(code);
    if (timingSafeEqual(expected, given) && matched === null) matched = now + w;
  }
  return matched;
}

export function otpauthUri(secretBase32: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}
