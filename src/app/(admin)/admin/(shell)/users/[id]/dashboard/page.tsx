"use client";

import { useParams } from "next/navigation";
import { isApiMode } from "@/lib/api/client";
import { ApiModeOnly } from "@/components/modules/rbac/shared";
import { EmployeeDashboardPage } from "@/components/modules/rbac/employee-dashboard";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return isApiMode ? <EmployeeDashboardPage id={id} /> : <ApiModeOnly title="Dashboard configuration" />;
}
