import { Suspense } from "react";
import { ForgotPasswordPage } from "@/components/auth/recovery-pages";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordPage />
    </Suspense>
  );
}
