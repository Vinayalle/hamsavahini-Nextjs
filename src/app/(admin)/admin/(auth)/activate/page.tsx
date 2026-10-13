import { Suspense } from "react";
import { AuthSkeleton } from "@/components/admin/skeletons";
import { ActivatePage } from "@/components/auth/activate-page";

export default function Page() {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <ActivatePage />
    </Suspense>
  );
}
