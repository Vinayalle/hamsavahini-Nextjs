import * as React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LuLoaderCircle as Loader2 } from "react-icons/lu";
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
/** Same looks, but the hover colour only applies while the button is enabled, so a disabled button does not "react" to the pointer. */
const buttonVariants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white enabled:hover:bg-brand-700 shadow-card",
  secondary: "bg-white text-ink border border-line enabled:hover:bg-canvas shadow-card",
  outline: "border border-line text-ink enabled:hover:bg-canvas",
  ghost: "text-muted enabled:hover:bg-canvas enabled:hover:text-ink",
  danger: "bg-danger-600 text-white enabled:hover:bg-red-800 shadow-card",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  icon: "h-9 w-9 justify-center",
};

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  variant?: Variant;
  size?: Size;
  /** Forces the spinner. Not needed for click handlers that return a promise: the button then shows it by itself while the promise is pending. */
  loading?: boolean;
  /**
   * If the handler returns a promise (an `async` function, or `() => save()`), the button shows a spinner and ignores further clicks until it
   * settles. So every button that runs an action on the server gets a loading state just by returning that action's promise.
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => unknown;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, type = "button", onClick, ...props },
  ref,
) {
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const busy = !!loading || pending;
  const handleClick = onClick
    ? (event: React.MouseEvent<HTMLButtonElement>) => {
        const result = onClick(event);
        if (result && typeof (result as PromiseLike<unknown>).then === "function") {
          setPending(true);
          const done = () => { if (mounted.current) setPending(false); };
          // Same outcome as before for the caller: a failure is still reported, the spinner just always stops.
          Promise.resolve(result).then(done, (error) => { done(); throw error; });
        }
      }
    : undefined;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={handleClick}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant],
        sizes[size],
        busy && "[&_svg:not([data-spinner])]:hidden", // the spinner replaces any icon inside the button
        className,
      )}
      {...props}
    >
      {busy && <Loader2 data-spinner className="size-4 animate-spin" aria-hidden />}
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
