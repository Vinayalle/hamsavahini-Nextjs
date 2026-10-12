"use client";

import { useSearchParams } from "next/navigation";
import { AccessDenied } from "@/components/admin/access-denied";

export default function AccessDeniedPage() {
  const from = useSearchParams().get("from") ?? undefined;
  return <AccessDenied from={from} />;
}
