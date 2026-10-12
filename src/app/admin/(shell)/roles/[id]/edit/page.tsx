"use client";

import { useParams } from "next/navigation";
import { isApiMode } from "@/lib/api/client";
import { ApiModeOnly } from "@/components/modules/rbac/shared";
import { RoleFormPage } from "@/components/modules/rbac/roles-ui";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return isApiMode ? <RoleFormPage id={id} /> : <ApiModeOnly title="Edit Role" />;
}
