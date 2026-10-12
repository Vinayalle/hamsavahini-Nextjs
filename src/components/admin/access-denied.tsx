"use client";

import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Shown when the signed-in employee opens a page they have not been given access to. */
export function AccessDenied({ from }: { from?: string }) {
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <div className="flex flex-col items-center px-8 py-12 text-center" role="alert">
        <span className="flex size-14 items-center justify-center rounded-full bg-danger-50 text-danger-600">
          <ShieldOff className="size-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-ink">Access denied</h1>
        <p className="mt-2 text-sm text-muted">
          You don&apos;t have permission to open this page. If you think you should, ask a Super Admin or your administrator to update your access.
        </p>
        {from && <p className="mt-3 break-all rounded bg-canvas px-2 py-1 font-mono text-xs text-muted">{from}</p>}
        <div className="mt-6 flex gap-3">
          <LinkButton href="/admin/dashboard">Go to dashboard</LinkButton>
          <Link href="/admin/profile" className="inline-flex h-9 items-center rounded-md border border-line px-4 text-sm font-medium text-ink hover:bg-canvas">My profile</Link>
        </div>
      </div>
    </Card>
  );
}
