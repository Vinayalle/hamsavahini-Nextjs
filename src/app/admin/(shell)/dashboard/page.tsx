"use client";

import { isApiMode } from "@/lib/api/client";
import { MockDashboardPage } from "@/components/modules/legacy/mock-dashboard-page";
import { ApiDashboard } from "@/components/modules/rbac/api-dashboard";

export default function Page() {
  return isApiMode ? <ApiDashboard /> : <MockDashboardPage />;
}
