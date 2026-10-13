import { Suspense } from "react";
import { AuthSkeleton } from "@/components/admin/skeletons";

// Pages here read the query string (?next=, ?token=), which needs a Suspense boundary for static rendering.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<AuthSkeleton />}>{children}</Suspense>;
}
