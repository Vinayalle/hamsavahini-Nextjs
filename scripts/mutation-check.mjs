// Mutation check for the security-critical code: each mutation breaks ONE security property on purpose, runs the relevant tests,
// and requires them to FAIL. A mutation that survives means a property is not actually protected by a test.
//
//   node scripts/mutation-check.mjs              run everything (about 15 minutes; each mutation provisions a throw-away database)
//   node scripts/mutation-check.mjs refresh      only mutations whose name starts with "refresh"
//   node scripts/mutation-check.mjs --list       list the mutations
//
// Source files are restored after every mutation (even on Ctrl-C, via the .mutbak copies; if a run was killed, restore with
// `git checkout` or by copying *.mutbak back). Do not edit source while this runs.
//
// "equivalent" mutations remove a check that a SECOND, independent check also performs (defence in depth), so removing only one
// cannot change behaviour. They are expected to survive and are reported separately.
import { readFileSync, writeFileSync, copyFileSync, unlinkSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const AUTH = ["src/server/__tests__/auth.test.ts", "src/server/__tests__/auth-units.test.ts"];
const RBAC = ["src/server/__tests__/rbac.test.ts"];
const MODULES = ["src/server/__tests__/modules-crud.test.ts", "src/server/__tests__/modules.test.ts", "src/server/__tests__/api.test.ts"];
const STORAGE = ["src/server/__tests__/storage.test.ts"];
const D = "src/server/authz/delegation.ts";

const M = [
  // ── authentication
  { name: "refresh: reuse detection off", tests: AUTH, file: "src/server/auth.ts", from: "if (row.usedAt) {", to: "if (false as boolean && row.usedAt) {" },
  { name: "otp: attempt budget not atomic", tests: AUTH, file: "src/server/account.ts", from: "attempts: { lt: challenge.maxAttempts }", to: "attempts: { gte: 0 }", equivalent: "the post-failure invalidation at maxAttempts is a second guard in sequential use" },
  { name: "otp: digest comparison disabled", tests: AUTH, file: "src/server/account.ts", from: "if (!safeEqualHex(otpDigest(challenge.id, user.id, code), challenge.codeDigest)) {", to: "if (false as boolean) {" },
  { name: "otp: lookup ignores expiry", tests: AUTH, file: "src/server/account.ts", from: 'purpose: "activation", consumedAt: null, invalidatedAt: null, expiresAt: { gt: new Date() } },\n    orderBy', to: 'purpose: "activation", consumedAt: null, invalidatedAt: null },\n    orderBy', equivalent: "the atomic attempt claim re-checks expiry" },
  { name: "otp: activation grant reusable", tests: AUTH, file: "src/server/account.ts", from: "const claimed = await tx.userToken.updateMany({ where: { id: grant.id, usedAt: null }, data: { usedAt: new Date() } });\n    if (claimed.count !== 1) throw expired();", to: "" },
  { name: "reset: sessions survive a password reset", tests: AUTH, file: "src/server/account.ts", from: '    await revokeUserSessions(tx, u.id);\n    await recordActivity(tx, { actorName: u.name, action: "password_reset"', to: '    await recordActivity(tx, { actorName: u.name, action: "password_reset"' },
  { name: "mfa: not required at login", tests: AUTH, file: "src/server/auth.ts", from: "if (await requiresMfa(db, user.id)) {\n    await db.adminUser.update", to: "if (false as boolean) {\n    await db.adminUser.update" },
  { name: "mfa: replay protection off", tests: AUTH, file: "src/server/mfa.ts", from: `AND ("lastUsedStep" IS NULL OR "lastUsedStep" < \${step})`, to: "" },
  { name: "mfa: recovery codes reusable", tests: AUTH, file: "src/server/mfa.ts", from: "where: { userId, codeDigest: recoveryDigest(userId, input.recoveryCode), usedAt: null }", to: "where: { userId, codeDigest: recoveryDigest(userId, input.recoveryCode) }" },
  { name: "mfa: reset open to non-super-admins", tests: AUTH, file: "src/server/mfa.ts", from: "if (!session.access.isSuperAdmin) throw errors.forbidden();", to: "" },
  { name: "mfa: session without MFA accepted for admins", tests: AUTH, file: "src/server/auth.ts", from: "if (!row.mfaVerifiedAt && (await requiresMfa(db, row.userId))) return null;", to: "" },
  { name: "jwt: algorithm not pinned", tests: AUTH, file: "src/server/tokens.ts", from: 'algorithms: ["HS256"],', to: "" },
  { name: "jwt: issuer not checked", tests: AUTH, file: "src/server/tokens.ts", from: "issuer: c.issuer,\n      audience", to: "audience" },
  { name: "session: token user not matched to session", tests: AUTH, file: "src/server/auth.ts", from: "row.userId !== claims.sub || ", to: "" },
  { name: "session: suspended user keeps session on refresh", tests: AUTH, file: "src/server/auth.ts", from: 'session.user.status !== "active" || ', to: "false || ", equivalent: "loadAccess().accessible rejects inactive accounts as well" },
  { name: "limits: rate limiter never blocks", tests: AUTH, file: "src/server/ratelimit.ts", from: "allowed: count <= limit.max", to: "allowed: true" },
  { name: "step-up: never required", tests: AUTH, file: "src/server/auth.ts", from: "if (Date.now() - session.authenticatedAt.getTime() > getAuthConfig().reauthWindowSeconds * 1000) throw errors.reauth();", to: "" },
  { name: "csrf: same-origin check removed", tests: AUTH, file: "src/server/http.ts", from: "if (!UNSAFE.has(request.method)) return;", to: "return;" },
  { name: "hash: memory parameter not compared for rehash", tests: AUTH, file: "src/server/security.ts", from: "return Number(m[1]) !== want.memoryCost || ", to: "return " },
  // ── CMS modules and file storage
  { name: "modules: PATCH re-applies schema defaults (resets unsent fields)", tests: MODULES, file: "src/server/resources/shared.ts", from: "  return z.object(shape) as never;", to: "  return schema.partial() as never;" },
  { name: "modules: assigned-only scope ignored in lists", tests: MODULES, file: "src/server/resources/framework.ts", from: "  return assignedFilter(session, cfg.permission, action);", to: "  authorize(session, cfg.permission, action);\n  return undefined;" },
  { name: "modules: workflow status change needs no change_status", tests: MODULES, file: "src/server/resources/framework.ts", from: '    else authorize(session, cfg.permission, "change_status");\n  }\n  if (cfg.visibility', to: '    else void 0;\n  }\n  if (cfg.visibility' },
  { name: "modules: assignee may be an ineligible employee", tests: MODULES, file: "src/server/resources/inbox.ts", from: 'if (!loaded.accessible || !hasPermission(loaded.access, permission, "view")) {', to: "if (false as boolean) {" },
  { name: "storage: any detected type accepted in any library", tests: STORAGE, file: "src/server/files.ts", from: "if (!detected || !allowed.includes(detected.kind)) throw", to: "if (!detected) throw" },
  { name: "storage: declared type need not match the content", tests: STORAGE, file: "src/server/files.ts", from: 'if (file.type && file.type !== detected.mime && !(detected.kind === "document" && file.type === "application/octet-stream")) {', to: "if (false as boolean) {" },
  { name: "storage: per-kind size cap removed", tests: STORAGE, file: "src/server/files.ts", from: "if (bytes.length > LIMITS[detected.kind]) throw", to: "if (false as boolean) throw" },
  { name: "storage: orphan object kept when the database write fails", tests: STORAGE, file: "src/server/services/library.ts", from: "    await storage.delete(key).catch(() => undefined); // do not leave an orphan object behind\n", to: "" },
  { name: "storage: media file served without a permission check", tests: STORAGE, file: "src/server/services/library.ts", from: 'authorize(session, "media", asDownload ? "download" : "view");', to: "void 0;" },
  { name: "storage: quarantined media still served", tests: STORAGE, file: "src/server/services/library.ts", from: 'if (!row || row.file.scanStatus === "quarantined") throw errors.notFound("File");', to: 'if (!row) throw errors.notFound("File");' },
  { name: "storage: documents published without publish permission", tests: STORAGE, file: "src/server/services/library.ts", from: 'authorizeStatusChange(session, "documents", null, parsed.data.status);', to: "void 0;" },
  // ── role-based access control
  { name: "rbac D1: self role/permission change allowed", tests: RBAC, file: D, from: "if (actor.user.id === targetUserId) throw", to: "if (false) throw" },
  { name: "rbac D2+D3+D4: admin limits removed", tests: RBAC, edits: [
    { file: D, from: "if (target.holdsSuperAdminRole && !actor.access.isSuperAdmin) throw", to: "if (false) throw" },
    { file: D, from: "if (!covers(actor.access, target.potential)) throw", to: "if (false) throw" },
    { file: D, from: "if (!covers(actor.access, proposed)) throw", to: "if (false) throw" },
  ] },
  { name: "rbac D5: can grant what you do not hold", tests: RBAC, file: D, from: "const bad = grants.filter((g) => !canGrant(actor.access, g.resource, g.action, g.scope))", to: "const bad = grants.filter(() => false)" },
  { name: "rbac: deny override ignored", tests: RBAC, file: "src/lib/authz/resolve.ts", from: "    grants.delete(key);", to: "    void key;" },
  { name: "rbac: deactivated access kept + sessions kept", tests: RBAC, edits: [
    { file: "src/server/authz/access.ts", from: "access: accessible ? potential : NO_ACCESS,", to: "access: potential," },
    { file: "src/server/auth.ts", from: "if (!loaded.accessible) {", to: "if (false) {" },
  ] },
  { name: "rbac: deactivation does not end sessions", tests: RBAC, file: "src/server/services/users.ts", from: "await tx.session.deleteMany({ where: { userId: id } });\n      await tx.userToken", to: "await tx.userToken" },
  { name: "rbac: authorize() always allows", tests: RBAC, file: "src/server/rbac.ts", from: "if (!can(session, resource, action)) throw errors.forbidden();", to: "if (false) throw errors.forbidden();" },
];

if (process.argv.includes("--list")) {
  for (const m of M) console.log(m.equivalent ? `${m.name}   [equivalent: ${m.equivalent}]` : m.name);
  process.exit(0);
}

const only = process.argv.slice(2).find((a) => !a.startsWith("--"));
const edits = (m) => m.edits ?? [{ file: m.file, from: m.from, to: m.to }];
const restore = (backups) => {
  for (const [p, bak] of backups) {
    if (existsSync(bak)) {
      copyFileSync(bak, p);
      unlinkSync(bak);
    }
  }
};

let gaps = 0;
const rows = [];
for (const m of M.filter((x) => !only || x.name.startsWith(only))) {
  const backups = [];
  let skipped = false;
  try {
    for (const e of edits(m)) {
      const p = join(root, e.file);
      const src = readFileSync(p, "utf8").replace(/\r\n/g, "\n");
      if (!src.includes(e.from)) {
        skipped = true;
        break;
      }
      // Back up each file ONCE (a mutation may edit the same file several times; a second copy would capture the mutated text).
      if (!backups.some(([bp]) => bp === p)) {
        copyFileSync(p, `${p}.mutbak`);
        backups.push([p, `${p}.mutbak`]);
      }
      writeFileSync(p, src.replace(e.from, e.to));
    }
    if (skipped) {
      rows.push(["SKIPPED (pattern no longer in source: update this script)", m.name]);
      gaps++;
      continue;
    }
    const r = spawnSync(process.execPath, ["scripts/test.mjs", ...m.tests, "--reporter=dot"], { cwd: root, encoding: "utf8", timeout: 400000 });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    const failed = /(\d+) failed/.exec(out);
    const caught = !!failed || r.status !== 0;
    if (caught) rows.push([`CAUGHT${failed ? ` (${failed[1]} failing)` : ""}`, m.name]);
    else if (m.equivalent) rows.push(["EQUIVALENT (survives by design)", `${m.name} - ${m.equivalent}`]);
    else {
      rows.push(["SURVIVED  <-- test gap", m.name]);
      gaps++;
    }
  } finally {
    restore(backups);
  }
}
console.log(rows.map(([s, n]) => `${s.padEnd(34)} ${n}`).join("\n"));
console.log(`\n${rows.length} mutations, ${gaps} unexpected survivors/skips`);
process.exit(gaps ? 1 : 0);
