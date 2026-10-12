"use client";

import { useParams } from "next/navigation";
import { isApiMode } from "@/lib/api/client";
import { ApiModeOnly } from "@/components/modules/rbac/shared";
import { EmployeeDetail } from "@/components/modules/rbac/employee-detail";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return isApiMode ? <EmployeeDetail id={id} /> : <ApiModeOnly title="Employee" />;
}
