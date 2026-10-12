"use client";

import { useParams } from "next/navigation";
import { isApiMode } from "@/lib/api/client";
import { ApiModeOnly } from "@/components/modules/rbac/shared";
import { EmployeeForm } from "@/components/modules/rbac/employee-form";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return isApiMode ? <EmployeeForm id={id} /> : <ApiModeOnly title="Edit Employee" />;
}
