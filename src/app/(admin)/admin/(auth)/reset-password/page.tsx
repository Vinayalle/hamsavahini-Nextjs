import { Suspense } from "react";
import { ResetPasswordPage } from "@/components/auth/recovery-pages";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPage />
    </Suspense>
  );
}
