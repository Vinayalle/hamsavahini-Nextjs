import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-card",
  secondary: "bg-white text-ink border border-line hover:bg-canvas shadow-card",
  outline: "border border-line text-ink hover:bg-canvas",
  ghost: "text-muted hover:bg-canvas hover:text-ink",
  danger: "bg-danger-600 text-white hover:bg-red-800 shadow-card",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  icon: "h-9 w-9 justify-center",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

/** Anchor styled as a button, for navigation actions. */
export function LinkButton({
  href, variant = "primary", size = "md", className, children, ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & { href: string; variant?: Variant; size?: Size }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-md font-medium transition-colors",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
