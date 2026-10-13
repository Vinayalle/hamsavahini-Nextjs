"use client";

import * as React from "react";
import * as Dd from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = Dd.Root;
export const DropdownTrigger = Dd.Trigger;

export function DropdownContent({ className, align = "end", ...props }: React.ComponentProps<typeof Dd.Content>) {
  return (
    <Dd.Portal>
      <Dd.Content
        align={align}
        sideOffset={6}
        className={cn("z-50 min-w-48 rounded-lg border border-line bg-surface p-1 shadow-pop", className)}
        {...props}
      />
    </Dd.Portal>
  );
}

export function DropdownItem({
  className, destructive, ...props
}: React.ComponentProps<typeof Dd.Item> & { destructive?: boolean }) {
  return (
    <Dd.Item
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        destructive ? "text-danger-600 data-[highlighted]:bg-danger-50" : "text-ink data-[highlighted]:bg-canvas",
        className,
      )}
      {...props}
    />
  );
}

export const DropdownLabel = ({ className, ...p }: React.ComponentProps<typeof Dd.Label>) => (
  <Dd.Label className={cn("px-2.5 py-1.5 text-xs font-medium text-muted", className)} {...p} />
);
export const DropdownSeparator = () => <Dd.Separator className="my-1 h-px bg-line" />;
