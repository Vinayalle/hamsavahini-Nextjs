import type { Scope } from "@/lib/authz/resolve";

/** Shapes returned by the RBAC API (mirrors src/server/services/{users,roles}.ts). */
export interface RoleRef { id: string; name: string; code: string; status: "active" | "inactive" }

export interface EmployeeDto {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  designation: string | null;
  reportingManager: { id: string; name: string } | null;
  status: "active" | "invited" | "suspended";
  twoFactorEnabled: boolean;
  roles: RoleRef[];
  assignedPageCount: number;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  deactivatedAt: string | null;
}

export interface EmployeeList {
  items: EmployeeDto[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  departments: string[];
}

export interface RoleDto {
  id: string;
  name: string;
  code: string;
  description: string;
  isSystem: boolean;
  status: "active" | "inactive";
  readOnly: boolean;
  userCount: number;
  permissionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDetail extends RoleDto {
  grants: { resource: string; action: string; scope: Scope }[];
  users: { id: string; name: string; employeeId: string; status: string; department: string | null }[];
  delegable: Record<string, Scope>;
  actorIsSuperAdmin: boolean;
}

export interface OverrideDto {
  resource: string;
  action: string;
  effect: "allow" | "deny";
  scope: Scope;
  reason: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface EmployeePermissions {
  user: { id: string; name: string; employeeId: string; status: string; isSuperAdmin: boolean };
  roles: RoleRef[];
  overrides: OverrideDto[];
  effective: Record<string, { scope: Scope; viaRoles: string[]; individual: boolean }>;
  /** What the roles alone grant (before overrides). */
  inherited: Record<string, { scope: Scope; viaRoles: string[] }>;
  denied: string[];
  delegable: Record<string, Scope>;
  actorCanManage: boolean;
}

export interface InviteResult {
  deliveredByEmail: boolean;
  inviteUrl?: string;
  expiresAt: string;
}

export interface HistoryItem {
  id: string;
  actorName: string;
  kind: string;
  change: Record<string, unknown>;
  createdAt: string;
}

export const STATUS_LABEL: Record<EmployeeDto["status"], string> = { active: "Active", invited: "Pending invitation", suspended: "Deactivated" };
