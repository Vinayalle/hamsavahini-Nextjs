import { Suspense } from "react";
import { ActivatePage } from "@/components/auth/activate-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ActivatePage />
    </Suspense>
  );
}
