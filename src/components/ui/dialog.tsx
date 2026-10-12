"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className, children, side = "center", ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "center" | "right" | "left" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy-950/50" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-surface shadow-pop focus:outline-none",
          side === "center" &&
            "left-1/2 top-1/2 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl",
          side === "right" && "inset-y-0 right-0 w-full max-w-lg",
          side === "left" && "inset-y-0 left-0 w-72",
          className,
        )}
        {...props}
      >
        {children}
        {side !== "left" && (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const DialogTitle = ({ className, ...p }: React.ComponentProps<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title className={cn("text-base font-semibold text-ink", className)} {...p} />
);
export const DialogDescription = ({ className, ...p }: React.ComponentProps<typeof DialogPrimitive.Description>) => (
  <DialogPrimitive.Description className={cn("mt-1 text-sm text-muted", className)} {...p} />
);
