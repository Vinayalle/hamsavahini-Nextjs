"use client";

import Link from "next/link";
import { Waves } from "lucide-react";

/** Centered card used by the public account pages (activation, forgot/reset password). */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-white"><Waves className="size-5" aria-hidden /></span>
          <span className="text-lg font-semibold tracking-tight text-ink">Hamsavahin</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

export function Unavailable() {
  return (
    <AuthShell title="Not available" subtitle="This page needs the database-backed mode.">
      <Link href="/admin/login" className="text-sm font-medium text-brand-600 hover:underline">Back to sign in</Link>
    </AuthShell>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600" role="alert">{children}</p>;
}

export function InfoNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md bg-success-50 px-3 py-2 text-sm text-success-600" role="status">{children}</p>;
}
