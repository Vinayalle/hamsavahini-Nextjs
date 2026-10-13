"use client";

import { useEffect, useState } from "react";
import { LuHardDrive as HardDrive } from "react-icons/lu";
import { apiFetch, isApiMode } from "@/lib/api/client";

/** null = still checking. Mock mode is always "configured" (it is a preview that stores nothing). */
export function useStorageConfigured(): boolean | null {
  const [configured, setConfigured] = useState<boolean | null>(isApiMode ? null : true);
  useEffect(() => {
    if (!isApiMode) return;
    let alive = true;
    apiFetch<{ configured: boolean }>("/api/storage/status").then((r) => alive && setConfigured(r.configured)).catch(() => alive && setConfigured(false));
    return () => { alive = false; };
  }, []);
  return configured;
}

/** Honest explanation shown when files cannot be stored. Lists variable NAMES only, never values. */
export function StorageNotice({ what, message }: { what?: string; message?: string }) {
  if (message) {
    return (
      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-warn-50 p-3 text-[13px] text-warn-600" role="note">
        <HardDrive className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{message}</p>
      </div>
    );
  }
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-warn-50 p-3 text-[13px] text-warn-600" role="note">
      <HardDrive className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p><strong>File storage is not configured.</strong> {what} cannot be uploaded or downloaded until an S3-compatible bucket is connected. Nothing is stored in the meantime.</p>
        <p className="mt-1">The server needs <code className="text-xs">S3_BUCKET</code>, <code className="text-xs">S3_ACCESS_KEY_ID</code> and <code className="text-xs">S3_SECRET_ACCESS_KEY</code> (plus <code className="text-xs">S3_ENDPOINT</code> and <code className="text-xs">S3_REGION</code> for non-AWS providers). See docs/operations.md.</p>
      </div>
    </div>
  );
}
