"use client";

import { isApiMode } from "@/lib/api/client";
import { MockRolesPage } from "@/components/modules/legacy/mock-roles-page";
import { RolesListPage } from "@/components/modules/rbac/roles-ui";

export default function Page() {
  return isApiMode ? <RolesListPage /> : <MockRolesPage />;
}
