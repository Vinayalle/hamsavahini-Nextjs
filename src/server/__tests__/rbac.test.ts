import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db";
import { setMailer } from "@/server/mail";
import { PASSWORD, call, ensurePermissions, loginCookie, makeRole, makeUser, setOverride } from "./helpers";
import * as login from "@/app/api/auth/login/route";
import * as me from "@/app/api/auth/me/route";
import * as pageAccess from "@/app/api/auth/page-access/route";
import * as forgot from "@/app/api/auth/password/forgot/route";
import * as reset from "@/app/api/auth/password/reset/route";
import * as changePw from "@/app/api/auth/change-password/route";
import * as users from "@/app/api/users/route";
import * as userById from "@/app/api/users/[id]/route";
import * as userStatus from "@/app/api/users/[id]/status/route";
import * as userRoles from "@/app/api/users/[id]/roles/route";
import * as userPerms from "@/app/api/users/[id]/permissions/route";
import * as userHistory from "@/app/api/users/[id]/history/route";
import * as userInvite from "@/app/api/users/[id]/invite/route";
import * as userDash from "@/app/api/users/[id]/dashboard/route";
import * as roles from "@/app/api/roles/route";
import * as roleById from "@/app/api/roles/[id]/route";
import * as roleGrants from "@/app/api/roles/[id]/permissions/route";
import * as roleStatus from "@/app/api/roles/[id]/status/route";
import * as roleDup from "@/app/api/roles/[id]/duplicate/route";
import * as dashboard from "@/app/api/dashboard/route";
import * as products from "@/app/api/products/route";
import * as categories from "@/app/api/categories/route";
import { assignedFilter, authorizeRecord } from "@/server/rbac";
import { resolveEffective } from "@/lib/authz/resolve";
import type { AuthSession } from "@/server/auth";

type Cookie = string;
const db = () => getDb();
const mk = (grants: Record<string, string[]>) => grants;

let saRole = "";
let adminRole = "";
const roleIds: Record<string, string> = {};
const uid = {} as Record<string, string>;
const ck = {} as Record<string, Cookie>;

async function resetIdentity() {
  await db().rateLimit.deleteMany();
  const d = db();
  await d.permissionChangeLog.deleteMany();
  await d.userDashboardPreference.deleteMany();
  await d.siteSetting.deleteMany({ where: { key: "dashboard_default" } });
  await d.userToken.deleteMany();
  await d.notificationLog.deleteMany();
  await d.session.deleteMany();
  await d.userPermissionOverride.deleteMany();
  await d.userRole.deleteMany();
  await d.adminUser.deleteMany();
  await d.rolePermission.deleteMany();
  await d.role.deleteMany();
  await d.product.deleteMany();
  await d.category.deleteMany();
}

/** Roles + people used by most tests. Rebuilt before every test so tests cannot affect each other. */
beforeEach(async () => {
  await ensurePermissions();
  await resetIdentity();
  saRole = (await makeRole("Super Admin", {}, true)).id;
  adminRole = (await makeRole("Admin", mk({
    users: ["view", "create", "edit", "assign", "change_status"], user_permissions: ["view", "manage_permissions"], user_dashboards: ["view", "edit"],
    roles: ["view"], products: ["view", "create", "edit", "publish", "unpublish"], categories: ["view"], activity_logs: ["view"],
  }), { isSystem: true })).id;
  roleIds.prodEditor = (await makeRole("Product Editor", mk({ products: ["view", "edit"] }))).id;
  roleIds.prodViewer = (await makeRole("Product Viewer", mk({ products: ["view"] }))).id;
  roleIds.catViewer = (await makeRole("Category Viewer", mk({ categories: ["view"] }))).id;
  roleIds.prodDeleter = (await makeRole("Product Deleter", mk({ products: ["view", "delete"] }))).id;
  roleIds.postsViewer = (await makeRole("Posts Viewer", mk({ posts: ["view"] }))).id;
  roleIds.nothing = (await makeRole("Blank", {})).id;

  uid.sa1 = (await makeUser("sa1@t.dev", saRole)).id;
  uid.sa2 = (await makeUser("sa2@t.dev", saRole)).id;
  uid.admin = (await makeUser("admin@t.dev", adminRole)).id;
  uid.emp = (await makeUser("emp@t.dev", roleIds.prodViewer)).id;
  uid.multi = (await makeUser("multi@t.dev", [roleIds.prodViewer, roleIds.catViewer])).id;
  uid.blank = (await makeUser("blank@t.dev", roleIds.nothing)).id;
  for (const k of ["sa1", "sa2", "admin", "emp", "multi", "blank"]) ck[k] = await loginCookie(`${k}@t.dev`);
});

beforeAll(() => setMailer(null));

const get = (h: Parameters<typeof call>[0], url: string, cookie?: Cookie, params?: Record<string, string>) => call(h, { url, cookie, params });
const send = (h: Parameters<typeof call>[0], method: string, url: string, cookie: Cookie | undefined, body?: unknown, params?: Record<string, string>) => call(h, { method, url, cookie, body: body ?? {}, params });

/* ═══════════════════════════ Super Admin ═══════════════════════════ */
describe("Super Admin", () => {
  it("lists employees with roles, page counts and filters", async () => {
    const r = await get(users.GET, "/api/users?pageSize=50&sortBy=employeeId&sortDir=asc", ck.sa1);
    expect(r.status).toBe(200);
    expect(r.data.total).toBe(6);
    const multi = r.data.items.find((i: { email: string }) => i.email === "multi@t.dev");
    expect(multi.roles.map((x: { name: string }) => x.name).sort()).toEqual(["Category Viewer", "Product Viewer"]);
    expect(multi.assignedPageCount).toBe(2); // products + categories
    expect(r.data.items.find((i: { email: string }) => i.email === "sa1@t.dev").isSuperAdmin).toBe(true);
    expect((await get(users.GET, `/api/users?roleId=${roleIds.catViewer}`, ck.sa1)).data.total).toBe(1);
    expect((await get(users.GET, "/api/users?search=EMP-0003", ck.sa1)).data.total).toBe(1);
    expect((await get(users.GET, "/api/users?lastLogin=never", ck.sa1)).data.total).toBe(0);
  });

  it("creates an employee with several roles; the invitation carries no secret and opens activation", async () => {
    const r = await send(users.POST, "POST", "/api/users", ck.sa1, { name: "New Person", email: "New.Person@T.dev", department: "Trade", roleIds: [roleIds.prodViewer, roleIds.catViewer] });
    expect(r.status).toBe(201);
    expect(r.data.employee.status).toBe("invited");
    expect(r.data.employee.email).toBe("new.person@t.dev"); // normalised
    expect(r.data.employee.roles).toHaveLength(2);
    expect(r.data.employee.employeeId).toMatch(/^EMP-\d{4}$/);
    expect(r.data.invite.deliveredByEmail).toBe(false);
    // The invitation carries NO secret: it points at the public activation page and the employee must still verify a one-time code.
    const url = new URL(r.data.invite.inviteUrl);
    expect(url.pathname).toBe("/admin/activate");
    expect(url.searchParams.get("token")).toBeNull();
    expect(await db().userToken.count({ where: { userId: r.data.employee.id, type: "invite", usedAt: null } })).toBe(1); // open-invitation marker
    expect(JSON.stringify(await db().activityLog.findMany())).not.toMatch(/botpb.*d{6}/i);
    expect(await db().permissionChangeLog.count({ where: { targetId: r.data.employee.id, kind: "role_assigned" } })).toBe(2);
    // cannot sign in until the invitation is accepted
    expect((await call(login.POST, { method: "POST", url: "/api/auth/login", body: { email: "new.person@t.dev", password: PASSWORD } })).status).toBe(401);
  });

  it("rejects duplicate emails and unknown roles", async () => {
    expect((await send(users.POST, "POST", "/api/users", ck.sa1, { name: "Dup", email: "EMP@t.dev" })).status).toBe(409);
    expect((await send(users.POST, "POST", "/api/users", ck.sa1, { name: "X", email: "x@t.dev", roleIds: ["0194b0e0-0000-7000-8000-000000000000"] })).status).toBe(422);
    expect((await send(users.POST, "POST", "/api/users", ck.sa1, { name: "", email: "bad" })).status).toBe(422);
  });

  it("allocates and revokes page access for an individual employee; the backend enforces it on the next request", async () => {
    expect((await get(categories.GET, "/api/categories", ck.emp)).status).toBe(403);
    const grant = await send(userPerms.PUT, "PUT", `/api/users/${uid.emp}/permissions`, ck.sa1, { overrides: [{ resource: "categories", action: "view", effect: "allow" }] }, { id: uid.emp });
    expect(grant.status).toBe(200);
    expect(grant.data.effective["categories:view"]).toMatchObject({ individual: true, viaRoles: [] });
    expect((await get(categories.GET, "/api/categories", ck.emp)).status).toBe(200); // same session cookie, no re-login
    expect((await call(pageAccess.GET, { url: "/api/auth/page-access?path=/admin/categories", cookie: ck.emp })).data.allowed).toBe(true);
    const revoke = await send(userPerms.PUT, "PUT", `/api/users/${uid.emp}/permissions`, ck.sa1, { overrides: [] }, { id: uid.emp });
    expect(revoke.status).toBe(200);
    expect((await get(categories.GET, "/api/categories", ck.emp)).status).toBe(403); // revoked immediately
    expect((await call(pageAccess.GET, { url: "/api/auth/page-access?path=/admin/categories", cookie: ck.emp })).data.allowed).toBe(false);
    const hist = await get(userHistory.GET, `/api/users/${uid.emp}/history`, ck.sa1, { id: uid.emp });
    expect(hist.data.items.map((h: { kind: string }) => h.kind)).toEqual(expect.arrayContaining(["override_set", "override_removed"]));
  });

  it("configures a role and its employees' effective access changes immediately", async () => {
    const created = await send(roles.POST, "POST", "/api/roles", ck.sa1, { name: "Catalogue Clerk", description: "Handles categories", grants: [{ resource: "categories", action: "view" }, { resource: "categories", action: "create" }] });
    expect(created.status).toBe(201);
    expect(created.data.code).toBe("catalogue_clerk");
    const rid = created.data.id as string;
    await send(userRoles.PUT, "PUT", `/api/users/${uid.emp}/roles`, ck.sa1, { roleIds: [roleIds.prodViewer, rid] }, { id: uid.emp });
    const body = { name: "Cat", slug: "cat-clerk-test" };
    expect((await send(categories.POST, "POST", "/api/categories", ck.emp, body)).status).toBe(201);
    // take 'create' away from the role: the employee loses it at once, with no re-login
    const r = await send(roleGrants.PUT, "PUT", `/api/roles/${rid}/permissions`, ck.sa1, { grants: [{ resource: "categories", action: "view" }] }, { id: rid });
    expect(r.status).toBe(200);
    expect(r.data.affectedEmployees).toBe(1);
    expect((await send(categories.POST, "POST", "/api/categories", ck.emp, { name: "Cat2", slug: "cat-clerk-2" })).status).toBe(403);
    expect(await db().permissionChangeLog.count({ where: { targetType: "role", targetId: rid, kind: "role_permissions_changed" } })).toBe(1);
  });

  it("configures an employee's dashboard; widgets never expose data the employee may not see", async () => {
    const before = await get(dashboard.GET, "/api/dashboard", ck.emp);
    expect(before.data.widgets.map((w: { key: string }) => w.key)).toEqual(expect.arrayContaining(["total_products", "published_products"]));
    expect(before.data.widgets.some((w: { key: string }) => w.key === "new_rfqs")).toBe(false); // no rfqs permission
    // cannot assign a widget for data the employee is not entitled to
    const bad = await send(userDash.PUT, "PUT", `/api/users/${uid.emp}/dashboard`, ck.sa1, { widgets: [{ key: "new_rfqs", enabled: true, order: 0 }], quickActions: [] }, { id: uid.emp });
    expect(bad.status).toBe(422);
    const ok = await send(userDash.PUT, "PUT", `/api/users/${uid.emp}/dashboard`, ck.sa1, { widgets: [{ key: "draft_products", enabled: true, order: 0 }, { key: "total_products", enabled: false, order: 1 }], quickActions: [] }, { id: uid.emp });
    expect(ok.status).toBe(200);
    const mine = await get(dashboard.GET, "/api/dashboard", ck.emp);
    expect(mine.data.widgets.map((w: { key: string }) => w.key)).toEqual(["draft_products"]);
    // revoke products:view: the saved widget disappears and its data is no longer returned
    await send(roleGrants.PUT, "PUT", `/api/roles/${roleIds.prodViewer}/permissions`, ck.sa1, { grants: [] }, { id: roleIds.prodViewer });
    const after = await get(dashboard.GET, "/api/dashboard", ck.emp);
    expect(after.data.widgets).toEqual([]);
    expect(JSON.stringify(after.data)).not.toContain("draft_products");
  });

  it("quick actions are filtered by permission too", async () => {
    const d = await get(dashboard.GET, "/api/dashboard", ck.emp);
    expect(d.data.quickActions.map((q: { key: string }) => q.key)).toEqual([]); // viewer cannot create products
    await setOverride(uid.emp, "products", "create", "allow");
    expect((await get(dashboard.GET, "/api/dashboard", ck.emp)).data.quickActions.map((q: { key: string }) => q.key)).toContain("add_product");
  });

  it("cannot deactivate, re-role or restrict THEMSELVES (no self-lockout)", async () => {
    expect((await send(userStatus.POST, "POST", `/api/users/${uid.sa1}/status`, ck.sa1, { status: "suspended" }, { id: uid.sa1 })).status).toBe(403);
    expect((await send(userRoles.PUT, "PUT", `/api/users/${uid.sa1}/roles`, ck.sa1, { roleIds: [] }, { id: uid.sa1 })).status).toBe(403);
    expect((await send(userPerms.PUT, "PUT", `/api/users/${uid.sa1}/permissions`, ck.sa1, { overrides: [] }, { id: uid.sa1 })).status).toBe(403);
  });

  it("two Super Admins deactivating each other at the same moment can never leave zero Super Admins", async () => {
    const [a, b] = await Promise.all([
      send(userStatus.POST, "POST", `/api/users/${uid.sa2}/status`, ck.sa1, { status: "suspended" }, { id: uid.sa2 }),
      send(userStatus.POST, "POST", `/api/users/${uid.sa1}/status`, ck.sa2, { status: "suspended" }, { id: uid.sa1 }),
    ]);
    const outcomes = [a.status, b.status].sort();
    expect(outcomes.filter((s) => s === 200).length).toBeLessThanOrEqual(1); // at most one succeeds
    const activeSAs = await db().adminUser.count({ where: { status: "active", roles: { some: { role: { code: "super_admin" } } } } });
    expect(activeSAs).toBeGreaterThanOrEqual(1);
  });

  it("the Super Admin role is read-only for everyone, including a Super Admin", async () => {
    expect((await send(roleGrants.PUT, "PUT", `/api/roles/${saRole}/permissions`, ck.sa1, { grants: [] }, { id: saRole })).status).toBe(403);
    expect((await send(roleById.PATCH, "PATCH", `/api/roles/${saRole}`, ck.sa1, { name: "Hacked Admin" }, { id: saRole })).status).toBe(403);
    expect((await send(roleStatus.POST, "POST", `/api/roles/${saRole}/status`, ck.sa1, { status: "inactive" }, { id: saRole })).status).toBe(403);
    expect((await call(roleById.DELETE, { method: "DELETE", url: `/api/roles/${saRole}`, cookie: ck.sa1, params: { id: saRole } })).status).toBe(409); // system role
  });
});

/* ═══════════════════════════ Admin (delegated authority) ═══════════════════════════ */
describe("Admin delegation limits", () => {
  it("can create an employee within their own authority", async () => {
    const r = await send(users.POST, "POST", "/api/users", ck.admin, { name: "Helper", email: "helper@t.dev", roleIds: [roleIds.prodEditor] });
    expect(r.status).toBe(201);
  });

  it("cannot assign a role that contains permissions beyond their own", async () => {
    const r = await send(users.POST, "POST", "/api/users", ck.admin, { name: "Greedy", email: "greedy@t.dev", roleIds: [roleIds.prodDeleter] });
    expect(r.status).toBe(403);
    expect(r.data.error.code).toBe("delegation_exceeded");
    expect(await db().adminUser.count({ where: { email: "greedy@t.dev" } })).toBe(0);
    const asg = await send(userRoles.PUT, "PUT", `/api/users/${uid.emp}/roles`, ck.admin, { roleIds: [roleIds.prodViewer, roleIds.prodDeleter] }, { id: uid.emp });
    expect(asg.status).toBe(403);
    expect(await db().userRole.count({ where: { userId: uid.emp } })).toBe(1); // unchanged
  });

  it("cannot assign the Super Admin role, nor manage a Super Admin", async () => {
    expect((await send(userRoles.PUT, "PUT", `/api/users/${uid.emp}/roles`, ck.admin, { roleIds: [saRole] }, { id: uid.emp })).status).toBe(403);
    expect((await send(users.POST, "POST", "/api/users", ck.admin, { name: "Boss", email: "boss@t.dev", roleIds: [saRole] })).status).toBe(403);
    for (const call_ of [
      () => send(userStatus.POST, "POST", `/api/users/${uid.sa1}/status`, ck.admin, { status: "suspended" }, { id: uid.sa1 }),
      () => send(userRoles.PUT, "PUT", `/api/users/${uid.sa1}/roles`, ck.admin, { roleIds: [] }, { id: uid.sa1 }),
      () => send(userPerms.PUT, "PUT", `/api/users/${uid.sa1}/permissions`, ck.admin, { overrides: [] }, { id: uid.sa1 }),
      () => send(userById.PATCH, "PATCH", `/api/users/${uid.sa1}`, ck.admin, { email: "attacker@t.dev" }, { id: uid.sa1 }),
      () => send(userInvite.POST, "POST", `/api/users/${uid.sa1}/invite`, ck.admin, undefined, { id: uid.sa1 }),
    ]) expect([403, 422]).toContain((await call_()).status);
    expect((await db().adminUser.findUniqueOrThrow({ where: { id: uid.sa1 } })).email).toBe("sa1@t.dev"); // no takeover via email change
    expect((await db().adminUser.findUniqueOrThrow({ where: { id: uid.sa1 } })).status).toBe("active");
  });

  it("cannot grant an individual permission they do not hold; can grant one they do", async () => {
    const tooMuch = await send(userPerms.PUT, "PUT", `/api/users/${uid.emp}/permissions`, ck.admin, { overrides: [{ resource: "products", action: "delete", effect: "allow" }] }, { id: uid.emp });
    expect(tooMuch.status).toBe(403);
    const roleGrant = await send(userPerms.PUT, "PUT", `/api/users/${uid.emp}/permissions`, ck.admin, { overrides: [{ resource: "roles", action: "manage_permissions", effect: "allow" }] }, { id: uid.emp });
    expect(roleGrant.status).toBe(403);
    expect((await send(userPerms.PUT, "PUT", `/api/users/${uid.emp}/permissions`, ck.admin, { overrides: [{ resource: "products", action: "create", effect: "allow" }] }, { id: uid.emp })).status).toBe(200);
    expect((await send(products.POST, "POST", "/api/products", ck.emp, {})).status).toBe(422); // reached validation = authorised to create
  });

  it("cannot elevate their own privileges by any route", async () => {
    expect((await send(userRoles.PUT, "PUT", `/api/users/${uid.admin}/roles`, ck.admin, { roleIds: [adminRole, saRole] }, { id: uid.admin })).status).toBe(403);
    expect((await send(userPerms.PUT, "PUT", `/api/users/${uid.admin}/permissions`, ck.admin, { overrides: [{ resource: "products", action: "create", effect: "allow" }] }, { id: uid.admin })).status).toBe(403);
    expect((await send(userStatus.POST, "POST", `/api/users/${uid.admin}/status`, ck.admin, { status: "suspended" }, { id: uid.admin })).status).toBe(403);
    expect((await send(userById.PATCH, "PATCH", `/api/users/${uid.admin}`, ck.admin, { department: "Everything" }, { id: uid.admin })).status).toBe(403); // organisational fields need another admin
    expect((await send(userById.PATCH, "PATCH", `/api/users/${uid.admin}`, ck.admin, { phone: "+1 555 0100" }, { id: uid.admin })).status).toBe(200); // harmless self-service allowed
  });

  it("cannot manage an employee who holds more permissions than they do", async () => {
    const strong = (await makeUser("strong@t.dev", [roleIds.prodViewer, roleIds.postsViewer])).id; // posts:view is beyond the Admin
    expect((await send(userStatus.POST, "POST", `/api/users/${strong}/status`, ck.admin, { status: "suspended" }, { id: strong })).status).toBe(403);
    expect((await send(userRoles.PUT, "PUT", `/api/users/${strong}/roles`, ck.admin, { roleIds: [roleIds.prodViewer] }, { id: strong })).status).toBe(403);
    expect((await send(userPerms.PUT, "PUT", `/api/users/${strong}/permissions`, ck.admin, { overrides: [] }, { id: strong })).status).toBe(403);
    expect((await db().adminUser.findUniqueOrThrow({ where: { id: strong } })).status).toBe("active");
  });

  it("a deactivated Super Admin is still protected: an Admin cannot reactivate them", async () => {
    await db().adminUser.update({ where: { id: uid.sa2 }, data: { status: "suspended" } });
    const r = await send(userStatus.POST, "POST", `/api/users/${uid.sa2}/status`, ck.admin, { status: "active" }, { id: uid.sa2 });
    expect(r.status).toBe(403);
    expect((await db().adminUser.findUniqueOrThrow({ where: { id: uid.sa2 } })).status).toBe("suspended");
  });

  it("does not get role administration, and cannot widen or narrow a role beyond what they hold", async () => {
    expect((await send(roles.POST, "POST", "/api/roles", ck.admin, { name: "Mine", description: "mine mine" })).status).toBe(403);
    expect((await send(roleGrants.PUT, "PUT", `/api/roles/${roleIds.prodViewer}/permissions`, ck.admin, { grants: [] }, { id: roleIds.prodViewer })).status).toBe(403); // no roles:manage_permissions
    expect((await get(roles.GET, "/api/roles", ck.admin)).status).toBe(200); // roles:view is granted
    // an Admin who WAS given roles:manage_permissions is still bounded by what they hold:
    const delegating = (await makeRole("Role Delegate", mk({ roles: ["view", "manage_permissions"], products: ["view", "edit"] }))).id;
    await makeUser("rd@t.dev", delegating);
    const rd = await loginCookie("rd@t.dev");
    expect((await send(roleGrants.PUT, "PUT", `/api/roles/${roleIds.prodViewer}/permissions`, rd, { grants: [{ resource: "products", action: "view" }, { resource: "products", action: "edit" }] }, { id: roleIds.prodViewer })).status).toBe(200);
    expect((await send(roleGrants.PUT, "PUT", `/api/roles/${roleIds.prodViewer}/permissions`, rd, { grants: [{ resource: "products", action: "view" }, { resource: "products", action: "delete" }] }, { id: roleIds.prodViewer })).status).toBe(403);
    expect((await send(roleGrants.PUT, "PUT", `/api/roles/${roleIds.prodDeleter}/permissions`, rd, { grants: [] }, { id: roleIds.prodDeleter })).status).toBe(403); // cannot strip what they do not hold
  });

  it("cannot reach settings-style or user-administration pages they were not given", async () => {
    for (const path of ["/admin/settings/general", "/admin/roles/new", "/admin/users/x/dashboard"]) {
      const r = await call(pageAccess.GET, { url: `/api/auth/page-access?path=${path}`, cookie: ck.admin });
      if (path === "/admin/users/x/dashboard") expect(r.data.allowed).toBe(true); // user_dashboards:view was delegated
      else expect(r.data.allowed).toBe(false);
    }
  });
});

/* ═══════════════════════════ Employees ═══════════════════════════ */
describe("Employee access", () => {
  it("can open permitted pages and is blocked from revoked pages by direct URL", async () => {
    const check = async (path: string, cookie = ck.emp) => (await call(pageAccess.GET, { url: `/api/auth/page-access?path=${encodeURIComponent(path)}`, cookie })).data;
    expect((await check("/admin/products")).allowed).toBe(true);
    expect((await check("/admin/products/some-id")).allowed).toBe(true);
    expect((await check("/admin/dashboard")).allowed).toBe(true);
    expect((await check("/admin/profile")).allowed).toBe(true);
    for (const blocked of ["/admin/products/new", "/admin/products/x/edit", "/admin/categories", "/admin/users", "/admin/roles", "/admin/users/x/permissions", "/admin/activity-logs", "/admin/settings/seo", "/admin/not-a-real-page"]) {
      expect((await check(blocked)).allowed, blocked).toBe(false);
    }
    expect((await check("/admin/products", "")).reason).toBe("unauthenticated");
  });

  it("cannot call user, role or permission APIs", async () => {
    for (const r of [
      await get(users.GET, "/api/users", ck.emp),
      await get(roles.GET, "/api/roles", ck.emp),
      await get(userPerms.GET, `/api/users/${uid.admin}/permissions`, ck.emp, { id: uid.admin }),
      await get(userHistory.GET, `/api/users/${uid.admin}/history`, ck.emp, { id: uid.admin }),
      await send(users.POST, "POST", "/api/users", ck.emp, { name: "Ab", email: "a@b.dev" }),
      await send(roles.POST, "POST", "/api/roles", ck.emp, { name: "Ab", description: "abcde" }),
      await send(userRoles.PUT, "PUT", `/api/users/${uid.emp}/roles`, ck.emp, { roleIds: [saRole] }, { id: uid.emp }),
    ]) expect(r.status).toBe(403);
  });

  it("can only perform actions that were granted", async () => {
    expect((await get(products.GET, "/api/products", ck.emp)).status).toBe(200);
    expect((await send(products.POST, "POST", "/api/products", ck.emp, {})).status).toBe(403);
    expect((await get(categories.GET, "/api/categories", ck.emp)).status).toBe(403);
    expect((await get(products.GET, "/api/products", ck.blank)).status).toBe(403);
  });

  it("a deactivated employee is locked out immediately: live sessions die and login is refused", async () => {
    expect((await get(me.GET, "/api/auth/me", ck.emp)).status).toBe(200);
    const r = await send(userStatus.POST, "POST", `/api/users/${uid.emp}/status`, ck.admin, { status: "suspended", reason: "left the company" }, { id: uid.emp });
    expect(r.status).toBe(200);
    expect(r.data.status).toBe("suspended");
    // The sessions must be gone BEFORE the cookie is ever replayed (replaying would clean them up as a side effect).
    expect(await db().session.count({ where: { userId: uid.emp } })).toBe(0);
    expect((await get(me.GET, "/api/auth/me", ck.emp)).status).toBe(401);
    expect((await get(products.GET, "/api/products", ck.emp)).status).toBe(401);
    expect((await call(login.POST, { method: "POST", url: "/api/auth/login", body: { email: "emp@t.dev", password: PASSWORD } })).status).toBe(401);
    // even with a still-valid session row (e.g. inserted by a bug), a non-active account gets nothing
    await db().adminUser.update({ where: { id: uid.emp }, data: { status: "active" } });
    const fresh = await loginCookie("emp@t.dev");
    await db().adminUser.update({ where: { id: uid.emp }, data: { status: "suspended" } });
    expect((await get(products.GET, "/api/products", fresh)).status).toBe(401);
  });

  it("an employee cannot read someone else's permissions or use another user's id to borrow access", async () => {
    // permissions come from the session, never from an id the browser sends
    const r = await get(me.GET, "/api/auth/me", ck.emp);
    expect(r.data.permissions).toEqual(["products:view"]);
    expect(r.data.isSuperAdmin).toBe(false);
    const forged = await call(me.GET, { url: `/api/auth/me?userId=${uid.sa1}`, cookie: ck.emp });
    expect(forged.data.user.email).toBe("emp@t.dev");
  });

  it("record-level scope: 'assigned' limits lists and single records to the user's own", () => {
    const access = resolveEffective({ accountActive: true, overrides: [], roles: [{ id: "r", name: "Enquiry Manager", active: true, isSuperAdmin: false, grants: [{ resource: "rfqs", action: "view", scope: "assigned" }, { resource: "rfqs", action: "edit", scope: "assigned" }, { resource: "enquiries", action: "view", scope: "all" }] }] });
    const s = { sessionId: "s", user: { id: "me", name: "Me", email: "m@t", employeeId: "EMP-1" }, roles: [], access, authenticatedAt: new Date(), mfaVerified: true } as AuthSession;
    expect(assignedFilter(s, "rfqs", "view")).toEqual({ assignedToId: "me" });
    expect(assignedFilter(s, "enquiries", "view")).toBeUndefined();
    expect(() => authorizeRecord(s, "rfqs", "edit", { assignedToId: "me" })).not.toThrow();
    expect(() => authorizeRecord(s, "rfqs", "edit", { assignedToId: "someone-else" })).toThrow(/not found/i); // out of scope looks like it does not exist
    expect(() => authorizeRecord(s, "rfqs", "edit", { assignedToId: null })).toThrow();
    expect(() => assignedFilter(s, "rfqs", "delete")).toThrow(); // no such grant
  });
});

/* ═══════════════════════════ Multiple roles & overrides ═══════════════════════════ */
describe("Multiple roles", () => {
  it("combines permissions from every assigned role", async () => {
    expect((await get(products.GET, "/api/products", ck.multi)).status).toBe(200);
    expect((await get(categories.GET, "/api/categories", ck.multi)).status).toBe(200);
    expect((await get(me.GET, "/api/auth/me", ck.multi)).data.permissions.sort()).toEqual(["categories:view", "products:view"]);
  });

  it("removing one role recalculates access at once; the other role's access stays", async () => {
    const r = await send(userRoles.PUT, "PUT", `/api/users/${uid.multi}/roles`, ck.sa1, { roleIds: [roleIds.prodViewer] }, { id: uid.multi });
    expect(r.status).toBe(200);
    expect((await get(categories.GET, "/api/categories", ck.multi)).status).toBe(403);
    expect((await get(products.GET, "/api/products", ck.multi)).status).toBe(200);
    expect(await db().permissionChangeLog.count({ where: { targetId: uid.multi, kind: "role_removed" } })).toBe(1);
  });

  it("an explicit denial beats role grants and survives role changes", async () => {
    await send(userRoles.PUT, "PUT", `/api/users/${uid.emp}/roles`, ck.sa1, { roleIds: [roleIds.prodEditor] }, { id: uid.emp });
    await send(userPerms.PUT, "PUT", `/api/users/${uid.emp}/permissions`, ck.sa1, { overrides: [{ resource: "products", action: "edit", effect: "deny" }] }, { id: uid.emp });
    const perms = await get(userPerms.GET, `/api/users/${uid.emp}/permissions`, ck.sa1, { id: uid.emp });
    expect(perms.data.denied).toContain("products:edit");
    expect(perms.data.effective["products:edit"]).toBeUndefined();
    expect(perms.data.effective["products:view"]).toBeDefined();
    const patch = await send((await import("@/app/api/products/[id]/route")).PATCH, "PATCH", `/api/products/${"0194b0e0-0000-7000-8000-000000000000"}`, ck.emp, { name: "xx" }, { id: "0194b0e0-0000-7000-8000-000000000000" });
    expect(patch.status).toBe(403); // denied before the (missing) record is even looked up
    // switching to another role that also grants edit does not lift the denial
    await send(userRoles.PUT, "PUT", `/api/users/${uid.emp}/roles`, ck.sa1, { roleIds: [roleIds.prodEditor, roleIds.prodViewer] }, { id: uid.emp });
    expect((await get(userPerms.GET, `/api/users/${uid.emp}/permissions`, ck.sa1, { id: uid.emp })).data.effective["products:edit"]).toBeUndefined();
  });

  it("an inactive role contributes nothing, effective immediately", async () => {
    expect((await get(products.GET, "/api/products", ck.emp)).status).toBe(200);
    const r = await send(roleStatus.POST, "POST", `/api/roles/${roleIds.prodViewer}/status`, ck.sa1, { status: "inactive" }, { id: roleIds.prodViewer });
    expect(r.status).toBe(200);
    expect(r.data.affectedEmployees).toBe(2); // emp + multi
    expect((await get(products.GET, "/api/products", ck.emp)).status).toBe(403);
    expect((await send(userRoles.PUT, "PUT", `/api/users/${uid.blank}/roles`, ck.sa1, { roleIds: [roleIds.prodViewer] }, { id: uid.blank })).status).toBe(422); // cannot assign an inactive role
    await send(roleStatus.POST, "POST", `/api/roles/${roleIds.prodViewer}/status`, ck.sa1, { status: "active" }, { id: roleIds.prodViewer });
    expect((await get(products.GET, "/api/products", ck.emp)).status).toBe(200);
  });

  it("overrides cannot restrict or extend a Super Admin", async () => {
    const r = await send(userPerms.PUT, "PUT", `/api/users/${uid.sa2}/permissions`, ck.sa1, { overrides: [{ resource: "products", action: "delete", effect: "deny" }] }, { id: uid.sa2 });
    expect(r.status).toBe(422);
  });

  it("rejects unknown permissions, assigned-scope on non-scopable resources and duplicates", async () => {
    const put = (overrides: unknown[]) => send(userPerms.PUT, "PUT", `/api/users/${uid.emp}/permissions`, ck.sa1, { overrides }, { id: uid.emp });
    expect((await put([{ resource: "products", action: "fly", effect: "allow" }])).status).toBe(422);
    expect((await put([{ resource: "products", action: "view", effect: "allow", scope: "assigned" }])).status).toBe(422);
    expect((await put([{ resource: "rfqs", action: "view", effect: "allow", scope: "assigned" }, { resource: "rfqs", action: "view", effect: "deny" }])).status).toBe(422);
    expect((await put([{ resource: "rfqs", action: "view", effect: "allow", scope: "assigned" }])).status).toBe(200);
  });
});

/* ═══════════════════════════ Role management ═══════════════════════════ */
describe("Roles", () => {
  it("validates permission sets (needs view, known permissions, scope rules)", async () => {
    const create = (grants: unknown[]) => send(roles.POST, "POST", "/api/roles", ck.sa1, { name: `R${Math.random()}`, description: "valid description", grants });
    expect((await create([{ resource: "products", action: "edit" }])).status).toBe(422); // edit without view
    expect((await create([{ resource: "nope", action: "view" }])).status).toBe(422);
    expect((await create([{ resource: "products", action: "view", scope: "assigned" }])).status).toBe(422);
    expect((await create([{ resource: "rfqs", action: "view", scope: "assigned" }, { resource: "rfqs", action: "edit", scope: "assigned" }])).status).toBe(201);
    expect((await send(roles.POST, "POST", "/api/roles", ck.sa1, { name: "Product Viewer", description: "duplicate name" })).status).toBe(409);
    expect((await send(roles.POST, "POST", "/api/roles", ck.sa1, { name: "Imposter", code: "super_admin", description: "reserved code" })).status).toBe(422);
  });

  it("protects system roles and roles that employees still use", async () => {
    expect((await call(roleById.DELETE, { method: "DELETE", url: `/api/roles/${adminRole}`, cookie: ck.sa1, params: { id: adminRole } })).status).toBe(409); // system
    const inUse = await call(roleById.DELETE, { method: "DELETE", url: `/api/roles/${roleIds.prodViewer}`, cookie: ck.sa1, params: { id: roleIds.prodViewer } });
    expect(inUse.status).toBe(409);
    expect(inUse.data.error.message).toMatch(/2 employees/);
    expect(await db().role.count({ where: { id: roleIds.prodViewer } })).toBe(1);
    expect((await call(roleById.DELETE, { method: "DELETE", url: `/api/roles/${roleIds.nothing}`, cookie: ck.sa1, params: { id: roleIds.nothing } })).status).toBe(409); // blank is still assigned to 'blank'
    await db().userRole.deleteMany({ where: { roleId: roleIds.postsViewer } });
    expect((await call(roleById.DELETE, { method: "DELETE", url: `/api/roles/${roleIds.postsViewer}`, cookie: ck.sa1, params: { id: roleIds.postsViewer } })).status).toBe(200);
  });

  it("duplicates a role with its permissions and records history", async () => {
    const r = await send(roleDup.POST, "POST", `/api/roles/${roleIds.prodEditor}/duplicate`, ck.sa1, { name: "Product Editor 2" }, { id: roleIds.prodEditor });
    expect(r.status).toBe(201);
    expect(r.data.grants.map((g: { action: string }) => g.action).sort()).toEqual(["edit", "view"]);
    expect(r.data.isSystem).toBe(false);
    // an Admin cannot duplicate a role with permissions beyond theirs
    expect((await send(roleDup.POST, "POST", `/api/roles/${roleIds.prodDeleter}/duplicate`, ck.admin, { name: "Sneaky" }, { id: roleIds.prodDeleter })).status).toBe(403);
  });
});

/* ═══════════════════════════ Account lifecycle ═══════════════════════════ */
describe("Password reset, password change and admin-sent links", () => {
  it("forgot-password never reveals whether an account exists; reset revokes every session", async () => {
    const sent: { to: string; text: string }[] = [];
    setMailer({ send: async (m) => { sent.push(m); return { delivered: true, providerMessageId: "t1" }; } });
    try {
      const unknown = await call(forgot.POST, { method: "POST", url: "/api/auth/password/forgot", body: { email: "nobody@t.dev" } });
      const known = await call(forgot.POST, { method: "POST", url: "/api/auth/password/forgot", body: { email: "emp@t.dev" } });
      expect(unknown.status).toBe(200);
      expect(known.status).toBe(200);
      expect(unknown.data).toEqual(known.data); // identical responses
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe("emp@t.dev");
      const token = new URL(/(https?:\/\/\S+)/.exec(sent[0].text)![1]).searchParams.get("token")!;
      expect((await call(reset.POST, { method: "POST", url: "/api/auth/password/reset", body: { token, password: "weak" } })).status).toBe(422);
      expect((await call(reset.POST, { method: "POST", url: "/api/auth/password/reset", body: { token, password: "Vast-Orchid-Lantern-47!" } })).status).toBe(200);
      expect((await get(me.GET, "/api/auth/me", ck.emp)).status).toBe(401); // old session revoked
      expect((await call(login.POST, { method: "POST", url: "/api/auth/login", body: { email: "emp@t.dev", password: PASSWORD } })).status).toBe(401); // old password dead
      expect((await call(login.POST, { method: "POST", url: "/api/auth/login", body: { email: "emp@t.dev", password: "Vast-Orchid-Lantern-47!" } })).status).toBe(200);
      expect((await call(reset.POST, { method: "POST", url: "/api/auth/password/reset", body: { token, password: "Silent-Harbor-Maple-91#" } })).status).toBe(422); // single use
      expect(JSON.stringify(await db().activityLog.findMany())).not.toContain(token);
    } finally {
      setMailer(null);
    }
  });

  it("changing your own password needs the current one and ends your other sessions", async () => {
    const other = await loginCookie("emp@t.dev");
    expect((await send(changePw.POST, "POST", "/api/auth/change-password", ck.emp, { current: "wrong-wrong-wrong", next: "Vast-Orchid-Lantern-47!" })).status).toBe(422);
    expect((await send(changePw.POST, "POST", "/api/auth/change-password", ck.emp, { current: PASSWORD, next: "weak" })).status).toBe(422);
    expect((await send(changePw.POST, "POST", "/api/auth/change-password", ck.emp, { current: PASSWORD, next: "Vast-Orchid-Lantern-47!" })).status).toBe(200);
    expect((await get(me.GET, "/api/auth/me", ck.emp)).status).toBe(200); // this session survives
    expect((await get(me.GET, "/api/auth/me", other)).status).toBe(401); // the other one does not
  });

  it("invitation for a deactivated account is refused; an active account gets a reset link instead", async () => {
    await db().adminUser.update({ where: { id: uid.blank }, data: { status: "suspended" } });
    expect((await send(userInvite.POST, "POST", `/api/users/${uid.blank}/invite`, ck.sa1, undefined, { id: uid.blank })).status).toBe(409);
    const r = await send(userInvite.POST, "POST", `/api/users/${uid.emp}/invite`, ck.sa1, undefined, { id: uid.emp });
    expect(r.status).toBe(200);
    expect(r.data.inviteUrl).toContain("/admin/reset-password?token=");
    expect(r.data.deliveredByEmail).toBe(false); // honest: no mail provider is configured
  });
});

/* ═══════════════════════════ Audit & history ═══════════════════════════ */
describe("Audit trail", () => {
  it("records who changed what, without secrets", async () => {
    await send(userRoles.PUT, "PUT", `/api/users/${uid.emp}/roles`, ck.admin, { roleIds: [roleIds.prodViewer, roleIds.prodEditor] }, { id: uid.emp });
    await send(userStatus.POST, "POST", `/api/users/${uid.emp}/status`, ck.admin, { status: "suspended", reason: "audit test" }, { id: uid.emp });
    const history = await db().permissionChangeLog.findMany({ where: { targetId: uid.emp }, orderBy: { createdAt: "asc" } });
    expect(history.map((h) => h.kind)).toEqual(["role_assigned", "status_changed"]);
    expect(history.every((h) => h.actorName === "admin")).toBe(true);
    const logs = JSON.stringify(await db().activityLog.findMany({ where: { entityId: uid.emp } }));
    expect(logs).toContain("access_changed");
    for (const row of await db().activityLog.findMany()) expect(`${row.detail ?? ""}${row.entityLabel}`).not.toMatch(/\$argon2|passwordHash|token=/);
    // a viewer of history needs the permission
    expect((await get(userHistory.GET, `/api/users/${uid.emp}/history`, ck.multi, { id: uid.emp })).status).toBe(403);
  });
});
