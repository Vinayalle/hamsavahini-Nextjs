"use client";

import { isApiMode } from "@/lib/api/client";
import { MockProfilePage } from "@/components/modules/legacy/mock-profile-page";
import { ProfilePage } from "@/components/modules/rbac/account-pages";

export default function Page() {
  return isApiMode ? <ProfilePage /> : <MockProfilePage />;
}
