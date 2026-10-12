"use client";

import { isApiMode } from "@/lib/api/client";
import { ApiModeOnly } from "@/components/modules/rbac/shared";
import { RoleFormPage } from "@/components/modules/rbac/roles-ui";

export default function Page() {
  return isApiMode ? <RoleFormPage /> : <ApiModeOnly title="New Role" />;
}
