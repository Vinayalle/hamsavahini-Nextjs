"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useShell } from "./shell";

/** Names the final (dynamic) breadcrumb. The label is bound to the current path so it can never leak onto another page. */
export function useBreadcrumbLabel(label: string | undefined | null) {
  const { setCrumb } = useShell();
  const pathname = usePathname();
  useEffect(() => {
    if (label) setCrumb({ path: pathname, label });
  }, [label, pathname, setCrumb]);
}
