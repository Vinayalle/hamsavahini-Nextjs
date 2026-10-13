import { Suspense } from "react";
import { AuthSkeleton } from "@/components/admin/skeletons";
import { ResetPasswordPage } from "@/components/auth/recovery-pages";

export default function Page() {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <ResetPasswordPage />
    </Suspense>
  );
}
