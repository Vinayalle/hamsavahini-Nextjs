"use client";

import { isApiMode } from "@/lib/api/client";
import { ApiModeOnly } from "@/components/modules/rbac/shared";
import { EmployeeForm } from "@/components/modules/rbac/employee-form";

export default function Page() {
  return isApiMode ? <EmployeeForm /> : <ApiModeOnly title="Add Employee" />;
}
