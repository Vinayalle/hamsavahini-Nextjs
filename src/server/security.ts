import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { getAuthConfig } from "./config";

/**
 * Passwords: Argon2id (the library default algorithm), 64 MiB / 3 passes / 1 lane (about 200 ms on the reference machine,
 * see scripts/bench-argon2.mjs). Parameters live in config so they can be raised later; stored hashes carry their own
 * parameters, and `passwordNeedsRehash` lets login upgrade older hashes transparently.
 */
export function hashPassword(password: string): Promise<string> {
  return hash(password, getAuthConfig().argon);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** True when the stored hash is not argon2id with (at least) the currently configured parameters. */
export function passwordNeedsRehash(passwordHash: string): boolean {
  const m = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(passwordHash);
  if (!m) return true; // another algorithm or malformed
  const want = getAuthConfig().argon;
  return Number(m[1]) !== want.memoryCost || Number(m[2]) !== want.timeCost || Number(m[3]) !== want.parallelism;
}

/** A real hash of a random value, verified against when the account does not exist (equalises timing). */
let dummyHash: Promise<string> | undefined;
export function dummyPasswordHash(): Promise<string> {
  return (dummyHash ??= hashPassword(randomBytes(16).toString("hex")));
}

/** 256-bit opaque token. Only its SHA-256 is stored server-side (the token is high entropy, so a fast hash is sufficient). */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}
