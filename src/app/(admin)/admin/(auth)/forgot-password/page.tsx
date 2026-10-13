import { Suspense } from "react";
import { AuthSkeleton } from "@/components/admin/skeletons";
import { ForgotPasswordPage } from "@/components/auth/recovery-pages";

export default function Page() {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <ForgotPasswordPage />
    </Suspense>
  );
}
