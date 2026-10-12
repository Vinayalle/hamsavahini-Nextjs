import { describe, expect, it } from "vitest";
import type { PasswordContext } from "./password-policy";
import { checkPassword, isCommonPassword, passwordProblem, passwordStrength, PASSWORD_MAX } from "./password-policy";

// The employee used in the specification's examples.
const ctx: PasswordContext = { name: "Harsha Sailesh", email: "harsha.sailesh@example.com" };
const ok = (p: string, c = ctx) => expect(checkPassword(p, c).ok, `${p} should be accepted: ${passwordProblem(p, c)}`).toBe(true);
const bad = (p: string, c = ctx) => expect(checkPassword(p, c).ok, `${p} should be rejected`).toBe(false);
const unmet = (p: string, c = ctx) => checkPassword(p, c).requirements.filter((r) => r.applicable && !r.met).map((r) => r.id);

describe("mandatory character requirements", () => {
  it("accepts a strong password that meets everything", () => ok("Tr0ub4dor&Horse-Stable"));

  it("requires at least 12 characters", () => {
    bad("Aa1!aaaaaaa"); // 11
    expect(unmet("Aa1!aaaaaaa")).toContain("length");
    ok("Xk9!vNq2#Lm4"); // exactly 12
  });
  it("requires an uppercase English letter", () => expect(unmet("xk9!vnq2#lm4zz")).toContain("upper"));
  it("requires a lowercase English letter", () => expect(unmet("XK9!VNQ2#LM4ZZ")).toContain("lower"));
  it("requires a digit", () => expect(unmet("Xk!vNq#Lm!zzTy")).toContain("digit"));
  it("requires a special character (spaces and letters do not count)", () => {
    expect(unmet("Xk9vNq2LmZzTyUw")).toContain("special");
    expect(unmet("Xk9 vNq2 Lm Zz Ty")).toContain("special");
    for (const s of ["!", "@", "#", "$", "%", "^", "&", "*", "_", "-", "+"]) ok(`Xk9${s}vNq2Lm4zZ`);
  });
  it("non-English letters do not satisfy the A-Z / a-z requirements", () => {
    expect(unmet("ÉÉÉÉÉÉÉ9!éééééé")).toEqual(expect.arrayContaining(["upper", "lower"]));
  });
  it("has a documented maximum length", () => {
    const long = "Xk9!vNq2#Lm4".repeat(12); // 144 chars
    expect(long.length).toBeGreaterThan(PASSWORD_MAX);
    expect(unmet(long)).toContain("length");
    expect(passwordProblem(long, ctx)).toMatch(/at most 128/);
  });
  it("never trims or alters the password: leading/trailing spaces are part of it", () => {
    ok("  Xk9!vNq2#Lm4zZ  ");
  });
});

describe("the specification's examples (employee Harsha Sailesh, harsha.sailesh@example.com)", () => {
  it("rejects a password containing the first name", () => { bad("Harsha@123456A"); expect(unmet("Harsha@123456A")).toContain("name"); });
  it("rejects a password containing the last name", () => { bad("Sailesh#2026Aa"); expect(unmet("Sailesh#2026Aa")).toContain("name"); });
  it("rejects a password containing the email username", () => { bad("harsha.sailesh@123A"); expect(unmet("harsha.sailesh@123A")).toContain("email"); });
  it("rejects a common, predictable pattern", () => { bad("Password@123A"); expect(unmet("Password@123A")).toContain("common"); });
});

describe("identity restrictions cannot be bypassed", () => {
  it("is case-insensitive", () => { bad("HARSHA!9xKqZw2#"); bad("sAiLeSh!9xKqZw2#"); });
  it("ignores separators between the letters", () => {
    bad("Har.sha!9xKqZw2#");
    bad("H-a-r-s-h-a!9xKqZw2#");
    bad("sai_lesh!9xKqZw2#R");
    bad("Harsha Sailesh9!xKq");
    bad("harsha_sailesh!9xK");
  });
  it("catches the full name written together or in either order", () => { bad("HarshaSailesh!9xKq"); bad("SaileshHarsha!9xKq"); });
  it("handles accents and look-alike Unicode forms", () => {
    bad("Hárshá!9xKqZw2#R"); // accents removed
    bad("ＨＡＲＳＨＡ!9xKqZw2#R"); // full-width letters (NFKD folds them)
    ok("Hárs!9xKqZw2#R", { name: "Harsha Sailesh", email: "x@y.com" }) // "hars" alone is not a name part
  });
  it("catches common leetspeak substitutions of longer fragments", () => {
    bad("H4rsh4!9xKqZw2#R");
    bad("S4ilesh!9xKqZwR#");
    bad("Sa1lesh!9xKqZwR#");
  });
  it("rejects the full email address and its pieces", () => {
    bad("harsha.sailesh@example.com1A!");
    bad("Xk9!harshasailesh@Zw");
  });
  it("applies to the organisation part of the domain, but not to generic mail providers", () => {
    const acme = { name: "Priya Nair", email: "p.nair@acmeminerals.in" };
    bad("Xk9!AcmeMinerals#2z", acme);
    ok("Xk9!vNq2#Lm4zZ", { name: "Priya Nair", email: "priya.nair@gmail.com" });
  });
  it("rejects the company name and its leetspeak form", () => {
    bad("Hamsavahin!2026xKq");
    bad("H4msavahin!2026xKq");
    bad("Aarth#2026!xKqZw");
  });
  it("rejects extra account-specific terms supplied by the caller", () => {
    bad("Emp0042!xKqZwRt#", { ...ctx, extraTerms: ["EMP-0042"] });
  });
  it("is generic: works for any employee, not hardcoded names", () => {
    const other = { name: "Chen Wei Lin", email: "wei.lin@corp-metals.cn" };
    bad("Chen!9xKqZw2#Rv", other);
    bad("xKq!WEILIN9zw2#", other);
    bad("xKq!CorpMetals9zw", other);
    ok("Xk9!vNq2#Lm4zZ", other);
  });
});

describe("short names and fragments do not cause excessive false positives", () => {
  const short = { name: "Al Li", email: "al.li@example.com" };
  it("ignores fragments under 3 characters", () => ok("Xk9!vNq2#Lm4zZ", short));
  it("a 3-letter name part matches only as a whole word", () => {
    const raj = { name: "Raj Rao", email: "raj.rao@example.com" };
    bad("Raj#9xKqZw2!Lm", raj); // whole word
    bad("xKqZ!rao9Lm2#", raj); // delimited by non-letters
    ok("Garage#9xKqZw2!Lm", raj); // "rag" inside a word, "raj" is not present anyway
    ok("Strao9!xKqZw2#Lm", raj); // "rao" buried inside a longer word: not flagged
  });
  it("does not reject an ordinary strong password just because a short name part appears by chance", () => {
    ok("Mx7$kQp2!vNzLe", { name: "Ann Lee", email: "ann.lee@example.com" });
  });
  it("works when no profile data is available (identity checks are skipped, the rest still applies)", () => {
    expect(checkPassword("Tr0ub4dor&Horse-Stable").ok).toBe(true);
    expect(checkPassword("Password@123A").ok).toBe(false);
  });
});

describe("common and predictable passwords", () => {
  it("blocks common passwords even when decorated", () => {
    for (const p of ["Password@123A", "P@ssw0rd!2026Zz", "Qwerty!123456Aa", "Welcome@2026Zq!", "Admin@123456Zq!", "Letmein!2026Zqx", "Iloveyou#2026Xz"]) bad(p, {});
  });
  it("blocks sequences, repeats and keyboard walks", () => {
    for (const p of ["Abcdef!234567Zq", "Zq!123456789012a", "Zq!aaaaaaaa9Xk", "Xk9!qwertyZq#2", "Xk9!asdfghZq#2"]) bad(p, {});
    expect(isCommonPassword("Zq!abcabcabc9X")).toBe(true);
  });
  it("does not flag random-looking strong passwords", () => {
    for (const p of ["Xk9!vNq2#Lm4zZ", "r7$Wt!pQ2mZ8xL", "Tr0ub4dor&Horse-Stable"]) expect(isCommonPassword(p)).toBe(false);
  });
});

describe("error messages are safe", () => {
  it("never echo the password or reveal the matched fragment", () => {
    for (const p of ["Harsha@123456A", "Password@123A", "harsha.sailesh@123A"]) {
      const msg = passwordProblem(p, ctx)!;
      expect(msg).toBeTruthy();
      expect(msg.toLowerCase()).not.toContain(p.toLowerCase());
      expect(msg.toLowerCase()).not.toContain("harsha");
      expect(msg.toLowerCase()).not.toContain("sailesh");
    }
  });
});

describe("strength indicator", () => {
  it("never shows a policy-violating password as strong", () => {
    expect(passwordStrength("Harsha@123456Aqz!", ctx).score).toBeLessThanOrEqual(1);
    expect(passwordStrength("Password@123A", ctx).score).toBe(0);
    expect(passwordStrength("short", ctx).score).toBeLessThanOrEqual(1);
  });
  it("scores a long random password highly", () => {
    expect(passwordStrength("r7$Wt!pQ2mZ8xLk#9Vb", ctx).score).toBeGreaterThanOrEqual(3);
    expect(passwordStrength("", ctx).label).toBe("Too weak");
  });
});
