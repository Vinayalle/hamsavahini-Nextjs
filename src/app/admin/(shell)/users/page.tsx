"use client";

import { isApiMode } from "@/lib/api/client";
import { MockUsersPage } from "@/components/modules/legacy/mock-users-page";
import { EmployeesPage } from "@/components/modules/rbac/employees-page";

export default function Page() {
  return isApiMode ? <EmployeesPage /> : <MockUsersPage />;
}
