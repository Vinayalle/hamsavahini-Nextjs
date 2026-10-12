"use client";

import { isApiMode } from "@/lib/api/client";
import { MockChangePasswordPage } from "@/components/modules/legacy/mock-change-password-page";
import { ChangePasswordPage } from "@/components/modules/rbac/account-pages";

export default function Page() {
  return isApiMode ? <ChangePasswordPage /> : <MockChangePasswordPage />;
}
