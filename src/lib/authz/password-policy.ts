import { COMMON_CONTAINS, COMMON_EXACT, KEYBOARD_WALKS } from "./common-passwords";

/**
 * PASSWORD POLICY: the single implementation, shared by the server (authoritative, enforced on every password-setting
 * path: activation, reset, change) and the UI (live checklist and strength meter).
 *
 * A password must:
 *   - be 12..128 characters (the maximum is a documented, generous limit so hashing cost stays bounded);
 *   - contain an English uppercase letter (A-Z), lowercase letter (a-z), digit (0-9) and a special character;
 *   - NOT contain the employee's name (full name or distinctive parts), email (full address, username or its
 *     meaningful fragments, organisation part of the domain) or the company name;
 *   - NOT be a common / predictable password (offline blocklist + keyboard walks, sequences, repeats).
 *
 * The password itself is never trimmed or altered. Only COPIES are normalised for comparison:
 *   case folded, accents removed, separators removed, and a conservative leetspeak fold (4->a, 0->o ...).
 * Short fragments are matched more carefully to avoid rejecting almost every password:
 *   fragments of 4+ characters match anywhere; 3-character fragments match only as whole "words" (delimited by a
 *   non-letter or the ends); fragments under 3 characters are ignored.
 */

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export interface PasswordContext {
  /** Employee's full name as recorded on the account. */
  name?: string;
  /** Registered work email. */
  email?: string;
  /** Other account-specific words that must not appear (e.g. employee ID). */
  extraTerms?: string[];
}

export interface Requirement {
  id: "length" | "upper" | "lower" | "digit" | "special" | "name" | "email" | "common";
  label: string;
  met: boolean;
  /** Identity checks are only evaluated when the matching profile data is known. */
  applicable: boolean;
}

export interface PasswordCheck {
  ok: boolean;
  requirements: Requirement[];
  /** First unmet requirement as a user-facing message. Never contains the password. */
  problem: string | null;
}

/** Company identifiers that must not be used as password components. */
export const COMPANY_TERMS = ["hamsavahin", "aarthmines", "aarth"];

/** Domain labels that identify a mail PROVIDER, not the employee's organisation, so they are not "account specific". */
const GENERIC_DOMAIN_LABELS = new Set([
  "gmail", "googlemail", "yahoo", "outlook", "hotmail", "live", "msn", "icloud", "proton", "protonmail", "aol", "zoho", "mail", "email", "example", "test", "company", "corp", "info",
]);

/* ───────────────────────── normalisation (copies only; the password is never modified) ───────────────────────── */

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
const stripSeparators = (s: string) => s.replace(/[^a-z0-9]/g, "");
const LEET: Record<string, string> = { "0": "o", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", $: "s", "+": "t", "!": "i", "|": "l" };
const leet = (s: string, one: "i" | "l") => s.replace(/[0345 78@$+!|1]/g, (c) => (c === "1" ? one : LEET[c] ?? c));

interface Variants {
  /** lower-cased with separators kept (used for whole-word matching of 3-letter fragments). */
  spaced: string;
  /** lower-cased, separators removed. */
  plain: string;
  /** leet-folded, separators removed (two readings of "1"). */
  leetI: string;
  leetL: string;
}

function variants(password: string): Variants {
  const f = fold(password);
  return { spaced: f, plain: stripSeparators(f), leetI: stripSeparators(leet(f, "i")), leetL: stripSeparators(leet(f, "l")) };
}

/** Does the (normalised) fragment appear in the password under the careful rules in the header comment? */
function containsFragment(v: Variants, rawFragment: string): boolean {
  const frag = stripSeparators(fold(rawFragment));
  if (frag.length < 3) return false;
  if (frag.length >= 4) {
    // Leet variants only for fragments of 5+ characters: "4"->"a" folds are unreliable on very short strings.
    return v.plain.includes(frag) || (frag.length >= 5 && (v.leetI.includes(frag) || v.leetL.includes(frag)));
  }
  // exactly 3 characters: whole-word match only (e.g. "Raj#..." yes, "garage" no)
  return new RegExp(`(^|[^a-z])${frag}($|[^a-z])`).test(v.spaced);
}

function fragments(text: string): string[] {
  return fold(text).split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3);
}

/* ───────────────────────── identity checks ───────────────────────── */

export function nameViolation(password: string, name: string | undefined): boolean {
  if (!name?.trim()) return false;
  const v = variants(password);
  const full = stripSeparators(fold(name));
  if (full.length >= 4 && (v.plain.includes(full) || v.leetI.includes(full) || v.leetL.includes(full))) return true;
  return fragments(name).some((t) => containsFragment(v, t));
}

export function emailViolation(password: string, email: string | undefined): boolean {
  if (!email?.includes("@")) return false;
  const v = variants(password);
  const e = fold(email.trim());
  if (v.spaced.includes(e) || v.plain.includes(stripSeparators(e))) return true; // full address
  const [local, domain = ""] = e.split("@");
  const localPlain = stripSeparators(local);
  if (localPlain.length >= 4 && (v.plain.includes(localPlain) || (localPlain.length >= 5 && (v.leetI.includes(localPlain) || v.leetL.includes(localPlain))))) return true; // username
  const localFragments = local.split(/[^\p{L}]+/u).filter((t) => t.length >= 3); // digits in the username are separators ("harsha.s2")
  if (localFragments.some((t) => containsFragment(v, t))) return true; // meaningful username fragments
  const labels = domain.split(".").slice(0, -1).filter((l) => l.length >= 4 && !GENERIC_DOMAIN_LABELS.has(l)); // organisation label(s), not the TLD
  return labels.some((l) => containsFragment(v, l));
}

export function companyViolation(password: string, extra: string[] = []): boolean {
  const v = variants(password);
  return [...COMPANY_TERMS, ...extra].some((t) => containsFragment(v, t));
}

/* ───────────────────────── common / predictable ───────────────────────── */

function hasSequence(s: string, len: number): boolean {
  let up = 1;
  let down = 1;
  for (let i = 1; i < s.length; i++) {
    const d = s.charCodeAt(i) - s.charCodeAt(i - 1);
    up = d === 1 ? up + 1 : 1;
    down = d === -1 ? down + 1 : 1;
    if (up >= len || down >= len) return true;
  }
  return false;
}

export function isCommonPassword(password: string): boolean {
  const v = variants(password);
  const bases = [v.plain, v.leetI, v.leetL];
  for (const b of bases) {
    const noDigitEdges = b.replace(/^\d+|\d+$/g, ""); // "password123" -> "password"
    if (COMMON_EXACT.has(b) || COMMON_EXACT.has(noDigitEdges)) return true;
    if (COMMON_CONTAINS.some((w) => b.includes(w))) return true;
    if (KEYBOARD_WALKS.some((walk) => { for (let i = 0; i + 5 <= walk.length; i++) if (b.includes(walk.slice(i, i + 5))) return true; return false; })) return true;
  }
  if (/(.)\1{4,}/.test(v.spaced)) return true; // aaaaa, 11111
  if (hasSequence(v.plain, 6)) return true; // abcdef, 123456, 654321
  if (/^(.{2,4})\1{2,}$/.test(v.plain)) return true; // abcabcabc
  return false;
}

/* ───────────────────────── evaluation ───────────────────────── */

export function checkPassword(password: string, ctx: PasswordContext = {}): PasswordCheck {
  const tooLong = password.length > PASSWORD_MAX;
  const hasEmail = !!ctx.email?.includes("@");
  const requirements: Requirement[] = [
    { id: "length", label: `At least ${PASSWORD_MIN} characters`, met: password.length >= PASSWORD_MIN && !tooLong, applicable: true },
    { id: "upper", label: "An uppercase letter (A-Z)", met: /[A-Z]/.test(password), applicable: true },
    { id: "lower", label: "A lowercase letter (a-z)", met: /[a-z]/.test(password), applicable: true },
    { id: "digit", label: "A number (0-9)", met: /[0-9]/.test(password), applicable: true },
    { id: "special", label: "A special character, e.g. ! @ # $ % ^ & * _ - +", met: /[^A-Za-z0-9\s]/.test(password), applicable: true },
    { id: "name", label: "Does not contain your name", met: !nameViolation(password, ctx.name) && !companyViolation(password, ctx.extraTerms), applicable: true },
    { id: "email", label: "Does not contain your email or username", met: !emailViolation(password, ctx.email), applicable: hasEmail },
    { id: "common", label: "Not a common or easily guessed password", met: password.length === 0 ? true : !isCommonPassword(password), applicable: true },
  ];
  // Messages never echo the password and never say WHICH fragment matched.
  const messages: Record<Requirement["id"], string> = {
    length: tooLong ? `Use at most ${PASSWORD_MAX} characters` : `Use at least ${PASSWORD_MIN} characters`,
    upper: "Add an uppercase letter (A-Z)",
    lower: "Add a lowercase letter (a-z)",
    digit: "Add a number (0-9)",
    special: "Add a special character such as ! @ # $ % ^ & * _ - +",
    name: "Password must not contain your name or the company name",
    email: "Password must not contain your email address or username",
    common: "That password is too common or predictable. Choose something less guessable",
  };
  const unmet = requirements.find((r) => r.applicable && !r.met);
  return { ok: !unmet, requirements, problem: unmet ? messages[unmet.id] : null };
}

/** First problem or null. Convenience for server error messages. */
export function passwordProblem(password: string, ctx: PasswordContext = {}): string | null {
  return checkPassword(password, ctx).problem;
}

/* ───────────────────────── strength indicator (local only) ───────────────────────── */

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: "Too weak" | "Weak" | "Fair" | "Good" | "Strong" };

/**
 * A rough, local estimate for the UI meter (nothing leaves the browser). Policy failures cap the score, so a password
 * that does not satisfy the policy can never display as "Good" or "Strong".
 */
export function passwordStrength(password: string, ctx: PasswordContext = {}): Strength {
  if (!password) return { score: 0, label: "Too weak" };
  const pool = (/[a-z]/.test(password) ? 26 : 0) + (/[A-Z]/.test(password) ? 26 : 0) + (/[0-9]/.test(password) ? 10 : 0) + (/[^A-Za-z0-9]/.test(password) ? 32 : 0);
  const unique = new Set(password).size;
  const bits = Math.log2(Math.max(pool, 2)) * Math.min(password.length, 32) * Math.min(1, unique / Math.max(1, password.length) + 0.35);
  let score: Strength["score"] = bits < 40 ? 0 : bits < 55 ? 1 : bits < 70 ? 2 : bits < 90 ? 3 : 4;
  const check = checkPassword(password, ctx);
  if (!check.ok) score = Math.min(score, check.requirements.find((r) => r.id === "common" && !r.met) ? 0 : 1) as Strength["score"];
  return { score, label: (["Too weak", "Weak", "Fair", "Good", "Strong"] as const)[score] };
}

/** Back-compat alias for the previous requirement list used by older UI code. */
export const PASSWORD_RULES = [
  { label: `At least ${PASSWORD_MIN} characters`, test: (p: string) => p.length >= PASSWORD_MIN },
  { label: "An uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "A number", test: (p: string) => /[0-9]/.test(p) },
  { label: "A symbol", test: (p: string) => /[^A-Za-z0-9\s]/.test(p) },
];
