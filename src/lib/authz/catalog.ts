/**
 * PERMISSION CATALOGUE: the single definition of every protectable resource ("page") and the actions that
 * are valid for it. Shared by the server (authorization, seeding, validation) and the UI (permission tree,
 * sidebar). Nothing else in the codebase may invent a permission key.
 *
 * A permission is the pair (resource, action), written "resource:action".
 */

export const ACTIONS = [
  "view", "create", "edit", "delete", "publish", "unpublish", "archive", "restore", "approve",
  "assign", "change_status", "upload", "download", "export", "manage_permissions", "manage_settings",
] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_LABEL: Record<Action, string> = {
  view: "View", create: "Create", edit: "Edit", delete: "Delete", publish: "Publish", unpublish: "Unpublish",
  archive: "Archive", restore: "Restore", approve: "Approve", assign: "Assign", change_status: "Change status",
  upload: "Upload", download: "Download", export: "Export", manage_permissions: "Manage permissions", manage_settings: "Manage settings",
};

export interface ModuleDef {
  key: string;
  label: string;
}

export interface ResourceDef {
  key: string;
  label: string;
  module: string;
  /** Actions that make sense for this resource. Anything else is rejected everywhere. */
  actions: readonly Action[];
  /** Supports record-level scope "assigned" (only records assigned to the user). */
  scopable?: boolean;
  /** Extra guard: only the Super Admin may delegate/hold these (system administration). */
  sensitive?: boolean;
}

export const MODULES: ModuleDef[] = [
  { key: "catalogue", label: "Product Catalogue" },
  { key: "content", label: "Content Management" },
  { key: "trade", label: "Trade Management" },
  { key: "enquiries", label: "Website Enquiries" },
  { key: "files", label: "Media & Documents" },
  { key: "notifications", label: "Notifications" },
  { key: "administration", label: "Administration" },
];

const CONTENT = ["view", "create", "edit", "delete", "publish", "unpublish", "archive", "restore"] as const;

export const RESOURCES: ResourceDef[] = [
  // Product Catalogue
  { key: "products", label: "Products", module: "catalogue", actions: [...CONTENT, "export"] },
  { key: "categories", label: "Categories", module: "catalogue", actions: [...CONTENT] },
  { key: "product_specifications", label: "Product Specifications", module: "catalogue", actions: ["view", "create", "edit", "delete"] },
  { key: "product_images", label: "Product Images", module: "catalogue", actions: ["view", "upload", "edit", "delete"] },
  { key: "product_documents", label: "Product Documents", module: "catalogue", actions: ["view", "upload", "download", "edit", "delete"] },
  // Content Management
  { key: "posts", label: "Posts / Insights", module: "content", actions: [...CONTENT] },
  { key: "projects", label: "Projects / Trade Stories", module: "content", actions: [...CONTENT] },
  { key: "careers", label: "Careers & Job Openings", module: "content", actions: [...CONTENT] },
  { key: "locations", label: "Global Operations / Locations", module: "content", actions: [...CONTENT] },
  { key: "banners", label: "Banners & Homepage Sections", module: "content", actions: [...CONTENT] },
  // Trade Management
  { key: "commodities", label: "Commodities", module: "trade", actions: [...CONTENT] },
  { key: "commodity_prices", label: "Commodity Prices", module: "trade", actions: ["view", "create", "edit", "delete", "publish", "unpublish"] },
  { key: "trade_opportunities", label: "Trade Opportunities", module: "trade", actions: ["view", "create", "edit", "delete", "publish", "unpublish", "archive", "change_status"] },
  { key: "rfqs", label: "RFQs & Trade Enquiries", module: "trade", actions: ["view", "edit", "assign", "change_status", "download", "export", "delete"], scopable: true },
  // Website Enquiries
  { key: "enquiries", label: "Contact Enquiries", module: "enquiries", actions: ["view", "edit", "assign", "change_status", "export", "delete"], scopable: true },
  { key: "job_applications", label: "Job Applications", module: "enquiries", actions: ["view", "edit", "change_status", "download", "export", "delete"] },
  // Media & Documents
  { key: "media", label: "Media Library", module: "files", actions: ["view", "upload", "edit", "delete", "download"] },
  { key: "documents", label: "Document Library", module: "files", actions: ["view", "upload", "edit", "delete", "download", "publish", "unpublish", "archive"] },
  // Notifications
  { key: "notification_history", label: "Notification History", module: "notifications", actions: ["view", "change_status"] },
  // Administration
  { key: "users", label: "Admin Users / Employees", module: "administration", actions: ["view", "create", "edit", "assign", "change_status", "export"], sensitive: true },
  { key: "user_permissions", label: "Permission Assignments", module: "administration", actions: ["view", "manage_permissions"], sensitive: true },
  { key: "user_dashboards", label: "Employee Dashboards", module: "administration", actions: ["view", "edit"], sensitive: true },
  { key: "roles", label: "Roles & Permissions", module: "administration", actions: ["view", "create", "edit", "delete", "assign", "change_status", "manage_permissions"], sensitive: true },
  { key: "activity_logs", label: "Activity Logs", module: "administration", actions: ["view", "export"], sensitive: true },
];

export type ResourceKey = (typeof RESOURCES)[number]["key"];
export type PermissionKey = `${string}:${Action}`;

const BY_KEY = new Map(RESOURCES.map((r) => [r.key, r]));
export const getResource = (key: string) => BY_KEY.get(key);
export const permKey = (resource: string, action: string): PermissionKey => `${resource}:${action}` as PermissionKey;

export function parsePermKey(key: string): { resource: string; action: Action } | null {
  const i = key.lastIndexOf(":");
  if (i < 1) return null;
  const resource = key.slice(0, i);
  const action = key.slice(i + 1) as Action;
  return isValidPermission(resource, action) ? { resource, action } : null;
}

export function isValidPermission(resource: string, action: string): boolean {
  const r = BY_KEY.get(resource);
  return !!r && (r.actions as readonly string[]).includes(action);
}

/** Every (resource, action) pair that exists. This is what the `Permission` table is synchronised to. */
export const ALL_PERMISSIONS: { resource: string; action: Action; module: string }[] = RESOURCES.flatMap((r) =>
  r.actions.map((action) => ({ resource: r.key, action, module: r.module })),
);

/* ───────────────────────── Page rules (route → required permission) ───────────────────────── */

export interface PageRule {
  /** Matches the pathname. Dynamic segments are written as `*`. */
  pattern: RegExp;
  resource: string;
  action: Action;
}

const id = "[^/]+";
/**
 * First match wins, so specific routes come before general ones. Routes that need no permission
 * (login, dashboard, profile, change-password, access-denied) are intentionally absent.
 */
export const PAGE_RULES: PageRule[] = [
  { pattern: /^\/admin\/products\/new$/, resource: "products", action: "create" },
  { pattern: new RegExp(`^/admin/products/${id}/edit$`), resource: "products", action: "edit" },
  { pattern: new RegExp(`^/admin/products(/${id})?$`), resource: "products", action: "view" },
  { pattern: /^\/admin\/categories$/, resource: "categories", action: "view" },
  { pattern: /^\/admin\/specifications$/, resource: "product_specifications", action: "view" },
  { pattern: /^\/admin\/product-images$/, resource: "product_images", action: "view" },
  { pattern: /^\/admin\/product-documents$/, resource: "product_documents", action: "view" },
  { pattern: /^\/admin\/posts\/new$/, resource: "posts", action: "create" },
  { pattern: new RegExp(`^/admin/posts/${id}/edit$`), resource: "posts", action: "edit" },
  { pattern: new RegExp(`^/admin/posts(/${id})?$`), resource: "posts", action: "view" },
  { pattern: /^\/admin\/projects\/new$/, resource: "projects", action: "create" },
  { pattern: new RegExp(`^/admin/projects/${id}/edit$`), resource: "projects", action: "edit" },
  { pattern: new RegExp(`^/admin/projects(/${id})?$`), resource: "projects", action: "view" },
  { pattern: /^\/admin\/careers\/new$/, resource: "careers", action: "create" },
  { pattern: new RegExp(`^/admin/careers/${id}/edit$`), resource: "careers", action: "edit" },
  { pattern: new RegExp(`^/admin/careers(/${id})?$`), resource: "careers", action: "view" },
  { pattern: /^\/admin\/locations\/new$/, resource: "locations", action: "create" },
  { pattern: new RegExp(`^/admin/locations/${id}/edit$`), resource: "locations", action: "edit" },
  { pattern: /^\/admin\/locations$/, resource: "locations", action: "view" },
  { pattern: /^\/admin\/banners\/new$/, resource: "banners", action: "create" },
  { pattern: new RegExp(`^/admin/banners/${id}/edit$`), resource: "banners", action: "edit" },
  { pattern: /^\/admin\/banners$/, resource: "banners", action: "view" },
  { pattern: /^\/admin\/commodities\/new$/, resource: "commodities", action: "create" },
  { pattern: new RegExp(`^/admin/commodities/${id}/edit$`), resource: "commodities", action: "edit" },
  { pattern: /^\/admin\/commodities$/, resource: "commodities", action: "view" },
  { pattern: /^\/admin\/commodity-prices$/, resource: "commodity_prices", action: "view" },
  { pattern: /^\/admin\/trade-opportunities\/new$/, resource: "trade_opportunities", action: "create" },
  { pattern: new RegExp(`^/admin/trade-opportunities/${id}/edit$`), resource: "trade_opportunities", action: "edit" },
  { pattern: /^\/admin\/trade-opportunities$/, resource: "trade_opportunities", action: "view" },
  { pattern: /^\/admin\/rfqs$/, resource: "rfqs", action: "view" },
  { pattern: /^\/admin\/enquiries$/, resource: "enquiries", action: "view" },
  { pattern: /^\/admin\/applications$/, resource: "job_applications", action: "view" },
  { pattern: /^\/admin\/media$/, resource: "media", action: "view" },
  { pattern: /^\/admin\/documents$/, resource: "documents", action: "view" },
  { pattern: /^\/admin\/notifications(\/history)?$/, resource: "notification_history", action: "view" },
  { pattern: /^\/admin\/users\/new$/, resource: "users", action: "create" },
  { pattern: new RegExp(`^/admin/users/${id}/permissions$`), resource: "user_permissions", action: "view" },
  { pattern: new RegExp(`^/admin/users/${id}/dashboard$`), resource: "user_dashboards", action: "view" },
  { pattern: new RegExp(`^/admin/users/${id}/edit$`), resource: "users", action: "edit" },
  { pattern: new RegExp(`^/admin/users(/${id})?$`), resource: "users", action: "view" },
  { pattern: /^\/admin\/roles\/new$/, resource: "roles", action: "create" },
  { pattern: new RegExp(`^/admin/roles/${id}/edit$`), resource: "roles", action: "edit" },
  { pattern: new RegExp(`^/admin/roles(/${id})?$`), resource: "roles", action: "view" },
  { pattern: /^\/admin\/activity-logs$/, resource: "activity_logs", action: "view" },
];

/** Pages every signed-in employee may open (identity/self-service). */
export const OPEN_PAGES = [/^\/admin\/dashboard$/, /^\/admin\/profile$/, /^\/admin\/change-password$/, /^\/admin\/access-denied$/];

export type PageRequirement = { kind: "open" } | { kind: "permission"; resource: string; action: Action } | { kind: "unknown" };

/** Which permission a pathname needs. Unknown admin routes are treated as unknown (denied for non-super-admins). */
export function requirementForPath(pathname: string): PageRequirement {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (OPEN_PAGES.some((re) => re.test(p))) return { kind: "open" };
  for (const rule of PAGE_RULES) if (rule.pattern.test(p)) return { kind: "permission", resource: rule.resource, action: rule.action };
  return { kind: "unknown" };
}

/* ───────────────────────── Dashboard widgets ───────────────────────── */

export interface WidgetDef {
  key: string;
  label: string;
  /** A widget is only available to someone who holds this permission (and its data is only computed for them). */
  requires: PermissionKey;
  href: string;
  /** Rendered as a counter card; "activity" widgets are lists. */
  kind: "metric" | "activity";
}

export const WIDGETS: WidgetDef[] = [
  { key: "total_products", label: "Total Products", requires: "products:view", href: "/admin/products", kind: "metric" },
  { key: "published_products", label: "Published Products", requires: "products:view", href: "/admin/products?status=published", kind: "metric" },
  { key: "draft_products", label: "Draft Products", requires: "products:view", href: "/admin/products?status=draft", kind: "metric" },
  { key: "active_commodities", label: "Active Commodities", requires: "commodities:view", href: "/admin/commodities", kind: "metric" },
  { key: "active_opportunities", label: "Active Trade Opportunities", requires: "trade_opportunities:view", href: "/admin/trade-opportunities", kind: "metric" },
  { key: "new_rfqs", label: "New RFQs", requires: "rfqs:view", href: "/admin/rfqs?status=new", kind: "metric" },
  { key: "assigned_rfqs", label: "Assigned RFQs", requires: "rfqs:view", href: "/admin/rfqs", kind: "metric" },
  { key: "new_enquiries", label: "New Contact Enquiries", requires: "enquiries:view", href: "/admin/enquiries?status=new", kind: "metric" },
  { key: "assigned_enquiries", label: "Assigned Enquiries", requires: "enquiries:view", href: "/admin/enquiries", kind: "metric" },
  { key: "open_applications", label: "Open Job Applications", requires: "job_applications:view", href: "/admin/applications?status=open", kind: "metric" },
  { key: "published_insights", label: "Published Insights", requires: "posts:view", href: "/admin/posts?status=published", kind: "metric" },
  { key: "global_locations", label: "Global Locations", requires: "locations:view", href: "/admin/locations", kind: "metric" },
  { key: "pending_reviews", label: "Pending Reviews", requires: "products:view", href: "/admin/products?status=draft", kind: "metric" },
  { key: "recent_activity", label: "Recent Activity", requires: "activity_logs:view", href: "/admin/activity-logs", kind: "activity" },
];
export const WIDGET_BY_KEY = new Map(WIDGETS.map((w) => [w.key, w]));

export interface QuickActionDef {
  key: string;
  label: string;
  href: string;
  requires: PermissionKey;
}
export const QUICK_ACTIONS: QuickActionDef[] = [
  { key: "add_product", label: "Add Product", href: "/admin/products/new", requires: "products:create" },
  { key: "create_post", label: "Create Post", href: "/admin/posts/new", requires: "posts:create" },
  { key: "add_project", label: "Add Project", href: "/admin/projects/new", requires: "projects:create" },
  { key: "add_location", label: "Add Location", href: "/admin/locations/new", requires: "locations:create" },
  { key: "add_commodity", label: "Add Commodity", href: "/admin/commodities/new", requires: "commodities:create" },
  { key: "review_enquiries", label: "Review Enquiries", href: "/admin/enquiries", requires: "enquiries:view" },
  { key: "review_rfqs", label: "Review RFQs", href: "/admin/rfqs", requires: "rfqs:view" },
  { key: "add_employee", label: "Add Employee", href: "/admin/users/new", requires: "users:create" },
];
export const QUICK_ACTION_BY_KEY = new Map(QUICK_ACTIONS.map((q) => [q.key, q]));
