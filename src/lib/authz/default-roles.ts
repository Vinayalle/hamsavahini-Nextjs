import { ALL_PERMISSIONS, getResource, type Action } from "./catalog";
import type { Scope } from "./resolve";

export interface DefaultGrant {
  resource: string;
  action: Action;
  scope?: Scope;
}
export interface DefaultRole {
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  grants: DefaultGrant[];
}

/** Every valid action on the given resources. */
const full = (...resources: string[]): DefaultGrant[] =>
  resources.flatMap((resource) => (getResource(resource)?.actions ?? []).map((action) => ({ resource, action })));
const some = (resource: string, ...actions: Action[]): DefaultGrant[] => actions.map((action) => ({ resource, action }));
const scoped = (resource: string, scope: Scope, ...actions: Action[]): DefaultGrant[] => actions.map((action) => ({ resource, action, scope }));

const CATALOGUE = ["products", "categories", "product_specifications", "product_images", "product_documents"];
const TRADE = ["commodities", "commodity_prices", "trade_opportunities", "rfqs"];

/**
 * The initial roles. The seed creates any that are missing (matched by `code`) and never overwrites a role an
 * administrator has already edited. The Super Admin role is the exception: it is always kept full-access.
 *
 * Admin deliberately gets NO role administration, settings or Super Admin management: it can delegate only
 * what it holds (see delegation rules in docs/rbac-architecture.md).
 */
export const DEFAULT_ROLES: DefaultRole[] = [
  {
    code: "super_admin", name: "Super Admin", isSystem: true,
    description: "Full access to every module, including administration. Cannot be edited or deleted.",
    grants: ALL_PERMISSIONS.map((p) => ({ resource: p.resource, action: p.action })),
  },
  {
    code: "admin", name: "Admin", isSystem: true,
    description: "Manages day-to-day content, trade and enquiries, and can manage employees within the permissions delegated to it.",
    grants: [
      ...full(...CATALOGUE, "posts", "projects", "careers", "locations", "banners", ...TRADE, "enquiries", "job_applications", "media", "documents"),
      ...some("notification_history", "view"),
      ...some("users", "view", "create", "edit", "assign", "change_status"),
      ...some("user_permissions", "view", "manage_permissions"),
      ...some("user_dashboards", "view", "edit"),
      ...some("roles", "view"),
      ...some("activity_logs", "view"),
    ],
  },
  {
    code: "content_manager", name: "Content Manager", isSystem: true,
    description: "Manages posts, projects, banners and media. Cannot manage users or settings.",
    grants: [...full("posts", "projects", "banners"), ...some("locations", "view", "create", "edit", "publish", "unpublish", "archive", "restore"), ...some("media", "view", "upload", "edit", "download"), ...some("documents", "view", "download")],
  },
  {
    code: "product_manager", name: "Product Manager", isSystem: true,
    description: "Manages products, categories, specifications, images and documents.",
    grants: [...full(...CATALOGUE), ...some("media", "view", "upload")],
  },
  {
    code: "trade_desk_manager", name: "Trade Desk Manager", isSystem: true,
    description: "Manages commodities, prices, trade opportunities and RFQs.",
    grants: [...full("commodities", "commodity_prices", "trade_opportunities", "rfqs"), ...some("enquiries", "view")],
  },
  {
    code: "hr_manager", name: "HR Manager", isSystem: true,
    description: "Manages careers and job applications.",
    grants: full("careers", "job_applications"),
  },
  {
    code: "enquiry_manager", name: "Enquiry Manager", isSystem: true,
    description: "Handles contact enquiries and the RFQs assigned to them.",
    grants: [...full("enquiries"), ...scoped("rfqs", "assigned", "view", "edit", "change_status", "download")],
  },
  {
    code: "custom_role", name: "Custom Role", isSystem: false,
    description: "A blank role to configure for a specific job. Starts with no permissions.",
    grants: [],
  },
];
