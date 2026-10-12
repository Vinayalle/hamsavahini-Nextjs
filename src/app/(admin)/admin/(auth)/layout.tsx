import { Suspense } from "react";

// Pages here read the query string (?next=, ?token=), which needs a Suspense boundary for static rendering.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
