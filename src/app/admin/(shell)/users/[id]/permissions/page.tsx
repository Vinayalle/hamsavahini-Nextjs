"use client";

import { useParams } from "next/navigation";
import { isApiMode } from "@/lib/api/client";
import { ApiModeOnly } from "@/components/modules/rbac/shared";
import { EmployeePermissionsPage } from "@/components/modules/rbac/employee-permissions";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return isApiMode ? <EmployeePermissionsPage id={id} /> : <ApiModeOnly title="Page access" />;
}
