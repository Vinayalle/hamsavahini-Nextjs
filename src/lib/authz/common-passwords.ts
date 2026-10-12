/**
 * Offline blocklist of common / predictable passwords (no network call, nothing is sent to a third party).
 *
 * Passwords are compared in a normalised "base" form (see password-policy.ts): lower-cased, accents removed,
 * common leetspeak folded (p@ssw0rd -> password) and separators removed, so trivial decoration cannot bypass it.
 *
 *  - EXACT: a password whose whole base form equals one of these is rejected (short words that would otherwise
 *    cause false positives if matched as substrings).
 *  - CONTAINS: a password whose base form CONTAINS one of these (6+ letters) is rejected.
 *
 * This is a practical filter, not a guarantee: a password not on this list can still be weak. It complements, and
 * does not replace, the length and complexity rules.
 */
export const COMMON_EXACT: ReadonlySet<string> = new Set([
  "admin", "administrator", "root", "user", "guest", "login", "master", "test", "temp", "demo", "abc", "abcd", "abcde", "abc123", "qwe", "qwerty", "asdf", "zxcv", "pass", "passwd",
  "secret", "super", "hello", "welcome", "monkey", "dragon", "letmein", "iloveyou", "sunshine", "princess", "football", "baseball", "soccer", "hockey", "batman", "superman",
  "trustno1", "starwars", "whatever", "freedom", "shadow", "michael", "jennifer", "jordan", "harley", "ranger", "buster", "thomas", "tigger", "robert", "daniel", "andrew",
  "joshua", "matthew", "charlie", "jessica", "ashley", "nicole", "hunter", "killer", "pepper", "cookie", "ginger", "summer", "winter", "spring", "autumn", "london", "india",
  "mumbai", "delhi", "dubai", "cricket", "krishna", "ganesh", "shiva", "sairam", "jaishriram", "omnamah", "chennai", "bangalore", "hyderabad", "kolkata", "company", "office",
  "work", "job", "employee", "manager", "trading", "commodity", "mining", "minerals", "metals", "steel", "copper", "aluminium", "export", "import", "shipping", "cargo",
]);

export const COMMON_CONTAINS: readonly string[] = [
  "password", "passw0rd", "passwd", "qwerty", "qwertyuiop", "asdfgh", "asdfghjkl", "zxcvbn", "zxcvbnm", "qazwsx", "qazxsw", "1q2w3e", "1qaz2wsx", "letmein", "welcome", "iloveyou",
  "administrator", "adminadmin", "changeme", "default", "p4ssw0rd", "trustno1", "football", "baseball", "sunshine", "princess", "superman", "batman", "starwars", "whatever",
  "freedom", "master", "dragon", "monkey", "shadow", "abcdef", "abcabc", "secret", "hamsavahin123", "company", "welcome1", "login", "mustang", "access", "flower", "hottie",
  "loveme", "654321", "123456", "12345678", "123123", "112233", "121212", "111111", "000000", "987654", "159753", "147258", "789456", "696969", "666666", "888888", "999999",
];

/** Keyboard rows / walks that are trivially guessable when 5+ consecutive keys appear. */
export const KEYBOARD_WALKS: readonly string[] = [
  "qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890", "qazwsxedc", "poiuytrewq", "lkjhgfdsa", "mnbvcxz", "0987654321",
];
