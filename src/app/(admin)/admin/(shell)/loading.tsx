import { PageSkeleton } from "@/components/admin/skeletons";

// Shown inside the admin shell while a page is loading (first visit, refresh, or navigation).
export default function Loading() {
  return <PageSkeleton />;
}
