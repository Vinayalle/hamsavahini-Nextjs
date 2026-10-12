import { describe, expect, it } from "vitest";
import {
  ACTIONS, ALL_PERMISSIONS, PAGE_RULES, QUICK_ACTIONS, RESOURCES, WIDGETS, getResource, isValidPermission, parsePermKey, requirementForPath,
} from "./catalog";
import {
  NO_ACCESS, canGrant, covers, diffAccess, hasPermission, resolveEffective, scopeFor, stateOf,
  type OverrideInput, type RoleInput,
} from "./resolve";
import { ALL_NAV_ITEMS } from "../../config/navigation";

const role = (name: string, grants: [string, string, ("all" | "assigned")?][], over: Partial<RoleInput> = {}): RoleInput => ({
  id: name, name, active: true, isSuperAdmin: false, grants: grants.map(([resource, action, scope]) => ({ resource, action, scope: scope ?? "all" })), ...over,
});
const resolve = (roles: RoleInput[], overrides: OverrideInput[] = [], accountActive = true) => resolveEffective({ accountActive, roles, overrides });
const deny = (resource: string, action: string): OverrideInput => ({ resource, action, effect: "deny", scope: "all" });
const allow = (resource: string, action: string, scope: "all" | "assigned" = "all"): OverrideInput => ({ resource, action, effect: "allow", scope });

describe("catalogue integrity", () => {
  it("has unique resource keys and only known actions", () => {
    const keys = RESOURCES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of RESOURCES) {
      expect(r.actions).toContain("view"); // every resource has a view gate
      for (const a of r.actions) expect(ACTIONS).toContain(a);
      expect(new Set(r.actions).size).toBe(r.actions.length);
    }
  });

  it("every page rule, widget and quick action points at a real permission", () => {
    for (const rule of PAGE_RULES) expect(isValidPermission(rule.resource, rule.action), `${rule.pattern}`).toBe(true);
    for (const w of WIDGETS) expect(parsePermKey(w.requires), w.key).not.toBeNull();
    for (const q of QUICK_ACTIONS) expect(parsePermKey(q.requires), q.key).not.toBeNull();
  });

  it("every sidebar link is protected by a page rule (no unguarded admin page)", () => {
    for (const item of ALL_NAV_ITEMS) {
      const path = item.href.split("?")[0];
      const req = requirementForPath(path);
      expect(["open", "permission"], `${path}`).toContain(req.kind);
    }
  });

  it("maps routes to the right permission; unknown admin routes are not open", () => {
    expect(requirementForPath("/admin/products")).toEqual({ kind: "permission", resource: "products", action: "view" });
    expect(requirementForPath("/admin/products/new")).toEqual({ kind: "permission", resource: "products", action: "create" });
    expect(requirementForPath("/admin/products/abc/edit")).toEqual({ kind: "permission", resource: "products", action: "edit" });
    expect(requirementForPath("/admin/users/abc/permissions")).toEqual({ kind: "permission", resource: "user_permissions", action: "view" });
    expect(requirementForPath("/admin/users/new")).toEqual({ kind: "permission", resource: "users", action: "create" });
    expect(requirementForPath("/admin/dashboard")).toEqual({ kind: "open" });
    expect(requirementForPath("/admin/products/")).toEqual({ kind: "permission", resource: "products", action: "view" }); // trailing slash
    expect(requirementForPath("/admin/secret-new-page").kind).toBe("unknown");
    expect(requirementForPath("/admin/products/a/b/c").kind).toBe("unknown");
  });

  it("scope only exists where record-level assignment exists", () => {
    expect(RESOURCES.filter((r) => r.scopable).map((r) => r.key).sort()).toEqual(["enquiries", "rfqs"]);
    expect(ALL_PERMISSIONS.length).toBeGreaterThan(100);
  });
});

describe("resolveEffective", () => {
  it("rule 1: a deactivated account has no permissions at all", () => {
    const roles = [role("Admin", [["products", "view"]]), role("SA", [], { isSuperAdmin: true })];
    expect(resolve(roles, [], false)).toBe(NO_ACCESS);
    expect(hasPermission(resolve(roles, [], false), "products", "view")).toBe(false);
  });

  it("rule 2: Super Admin holds everything and overrides cannot restrict it", () => {
    const sa = resolve([role("Super Admin", [], { isSuperAdmin: true })], [deny("products", "delete")]);
    expect(sa.isSuperAdmin).toBe(true);
    expect(sa.grants.size).toBe(ALL_PERMISSIONS.length);
    expect(hasPermission(sa, "products", "delete")).toBe(true);
    expect(hasPermission(sa, "rfqs", "view", "all")).toBe(true);
  });

  it("an INACTIVE super-admin role does not make the user a super admin", () => {
    const a = resolve([role("Super Admin", [["products", "view"]], { isSuperAdmin: true, active: false })]);
    expect(a.isSuperAdmin).toBe(false);
    expect(a.grants.size).toBe(0);
  });

  it("rule 3: multiple roles combine additively", () => {
    const a = resolve([role("Product Manager", [["products", "view"], ["products", "edit"]]), role("Trade Desk", [["rfqs", "view"], ["products", "view"]])]);
    expect(hasPermission(a, "products", "edit")).toBe(true);
    expect(hasPermission(a, "rfqs", "view")).toBe(true);
    expect(hasPermission(a, "products", "delete")).toBe(false);
    expect(a.grants.get("products:view")!.viaRoles).toEqual(["Product Manager", "Trade Desk"]); // both sources are reported
  });

  it("rule 3: when scopes differ the broadest wins", () => {
    const a = resolve([role("Enquiry Manager", [["rfqs", "view", "assigned"]]), role("Trade Desk", [["rfqs", "view", "all"]])]);
    expect(scopeFor(a, "rfqs", "view")).toBe("all");
    const b = resolve([role("Enquiry Manager", [["rfqs", "view", "assigned"]])]);
    expect(scopeFor(b, "rfqs", "view")).toBe("assigned");
  });

  it("rule 3: an inactive role contributes nothing", () => {
    const a = resolve([role("Old", [["products", "view"]], { active: false })]);
    expect(a.grants.size).toBe(0);
  });

  it("rule 4: an allow override adds a permission and is reported as individual", () => {
    const a = resolve([role("R", [["products", "view"]])], [allow("posts", "view"), allow("posts", "edit")]);
    expect(hasPermission(a, "posts", "edit")).toBe(true);
    expect(stateOf(a, "posts", "edit")).toMatchObject({ state: "individual", alsoRoles: [] });
    expect(stateOf(a, "products", "view")).toMatchObject({ state: "role", roles: ["R"] });
  });

  it("rule 4: a deny override beats a role grant", () => {
    const a = resolve([role("R", [["products", "view"], ["products", "delete"]])], [deny("products", "delete")]);
    expect(hasPermission(a, "products", "delete")).toBe(false);
    expect(hasPermission(a, "products", "view")).toBe(true);
    expect(stateOf(a, "products", "delete")).toEqual({ state: "denied" });
  });

  it("rule 4: a deny beats an allow override too, in any order", () => {
    const a1 = resolve([role("R", [["posts", "view"]])], [allow("posts", "edit"), deny("posts", "edit")]);
    const a2 = resolve([role("R", [["posts", "view"]])], [deny("posts", "edit"), allow("posts", "edit")]);
    expect(hasPermission(a1, "posts", "edit")).toBe(false);
    expect(hasPermission(a2, "posts", "edit")).toBe(false);
  });

  it("rule 4: removing one role recalculates (only that role's grants disappear)", () => {
    const pm = role("Product Manager", [["products", "view"], ["products", "edit"]]);
    const hr = role("HR Manager", [["careers", "view"]]);
    const both = resolve([pm, hr]);
    const only = resolve([hr]);
    expect(diffAccess(both, only).removed).toEqual(["products:edit", "products:view"]);
    expect(hasPermission(only, "careers", "view")).toBe(true);
  });

  it("rule 5: no action without view; denying view removes the rest", () => {
    const noView = resolve([role("R", [["products", "edit"], ["products", "delete"]])]);
    expect(noView.grants.size).toBe(0);
    const a = resolve([role("R", [["products", "view"], ["products", "edit"]])], [deny("products", "view")]);
    expect(hasPermission(a, "products", "edit")).toBe(false);
    expect(a.grants.size).toBe(0);
  });

  it("rule 6: scope 'assigned' is only honoured on scopable resources", () => {
    const a = resolve([role("R", [["products", "view", "assigned"], ["rfqs", "view", "assigned"]])]);
    expect(scopeFor(a, "products", "view")).toBe("all");
    expect(scopeFor(a, "rfqs", "view")).toBe("assigned");
    expect(hasPermission(a, "rfqs", "view", "all")).toBe(false);
    expect(hasPermission(a, "rfqs", "view", "assigned")).toBe(true);
  });

  it("rule 7: permissions outside the catalogue are ignored", () => {
    const a = resolve([role("R", [["products", "view"], ["nope", "view"], ["products", "teleport"], ["rfqs", "publish"]])], [allow("ghost", "view")]);
    expect([...a.grants.keys()]).toEqual(["products:view"]);
    expect(isValidPermission("rfqs", "publish")).toBe(false);
    expect(getResource("rfqs")?.actions).not.toContain("publish");
  });
});

describe("delegation helpers", () => {
  const admin = resolve([role("Admin", [["products", "view"], ["products", "edit"], ["rfqs", "view", "assigned"]])]);
  const sa = resolve([role("SA", [], { isSuperAdmin: true })]);

  it("an actor can only grant what they hold", () => {
    expect(canGrant(admin, "products", "edit")).toBe(true);
    expect(canGrant(admin, "products", "delete")).toBe(false);
    expect(canGrant(admin, "roles", "manage_permissions")).toBe(false);
    expect(canGrant(admin, "nonsense", "view")).toBe(false);
    expect(canGrant(sa, "roles", "manage_permissions")).toBe(true);
  });

  it("an actor cannot grant a broader scope than their own", () => {
    expect(canGrant(admin, "rfqs", "view", "assigned")).toBe(true);
    expect(canGrant(admin, "rfqs", "view", "all")).toBe(false);
  });

  it("an inactive actor can grant nothing", () => {
    expect(canGrant(resolve([role("SA", [], { isSuperAdmin: true })], [], false), "products", "view")).toBe(false);
  });

  it("covers(): an admin can only manage someone whose access is a subset of their own", () => {
    const small = resolve([role("R", [["products", "view"]])]);
    const extra = resolve([role("R", [["products", "view"], ["posts", "view"]])]);
    expect(covers(admin, small)).toBe(true);
    expect(covers(admin, extra)).toBe(false);
    expect(covers(admin, sa)).toBe(false); // never over a super admin
    expect(covers(sa, extra)).toBe(true);
  });

  it("diffAccess reports added, removed and scope changes", () => {
    const before = resolve([role("R", [["rfqs", "view", "assigned"], ["products", "view"]])]);
    const after = resolve([role("R", [["rfqs", "view", "all"], ["posts", "view"]])]);
    expect(diffAccess(before, after)).toEqual({ added: ["posts:view"], removed: ["products:view"], changedScope: ["rfqs:view"] });
  });
});
