"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ───────────────────────── ConfirmDialog ───────────────────────── */
export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel",
  destructive, loading, onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6">
        <div className="flex gap-4">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", destructive ? "bg-danger-50 text-danger-600" : "bg-brand-50 text-brand-600")}>
            <AlertTriangle className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 pr-4">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{cancelLabel}</Button>
          <Button variant={destructive ? "danger" : "primary"} loading={loading} onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────── Promise-based confirm() provider ───────────────── */
type ConfirmOptions = Omit<ConfirmDialogProps, "open" | "onOpenChange" | "onConfirm" | "loading">;
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={!!options}
        onOpenChange={(o) => !o && settle(false)}
        title={options?.title ?? ""}
        description={options?.description}
        confirmLabel={options?.confirmLabel}
        cancelLabel={options?.cancelLabel}
        destructive={options?.destructive}
        onConfirm={() => settle(true)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

/* ───────────────────────── UnsavedChangesDialog ───────────────────────── */
export function UnsavedChangesDialog({
  open, onStay, onLeave,
}: { open: boolean; onStay: () => void; onLeave: () => void }) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => !o && onStay()}
      title="Discard unsaved changes?"
      description="You have changes that haven't been saved. If you leave this page they will be lost."
      confirmLabel="Discard & leave"
      cancelLabel="Keep editing"
      destructive
      onConfirm={onLeave}
    />
  );
}

/**
 * Warns before leaving a dirty form: browser close/reload (beforeunload), in-app link clicks,
 * and programmatic navigation through the returned `navigate`.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(url.pathname + url.search);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const navigate = useCallback(
    (href: string) => {
      if (dirty) setPending(href);
      else router.push(href);
    },
    [dirty, router],
  );

  const dialog = (
    <UnsavedChangesDialog
      open={pending !== null}
      onStay={() => setPending(null)}
      onLeave={() => {
        const href = pending;
        setPending(null);
        if (href) router.push(href);
      }}
    />
  );

  return { navigate, dialog };
}
