import { BRAND } from "@/config/brand";

/**
 * The company logo. One component for every place it appears.
 *
 *   variant="mark"     the swan and lotus only (tab icons, collapsed sidebar, small spaces)
 *   variant="lockup"   the mark and the HAMSAVAHIN wordmark side by side (website header and footer, admin sidebar)
 *   variant="full"     the complete stacked logo (sign-in pages, hero areas)
 *
 * Size it with a height class, for example `className="h-12"` or `className="h-11 sm:h-14"`; the width follows the artwork.
 * For a lockup the height is the height of the whole logo (the mark); the wordmark is drawn at 62% of it, which keeps both parts balanced.
 * The intrinsic width and height of every picture are set, so nothing jumps while it loads.
 * The text alternative sits on the first picture; the wordmark beside it is decorative.
 */
export function Logo({ variant = "lockup", priority = false, className = "h-12" }: { variant?: "mark" | "lockup" | "full"; priority?: boolean; className?: string }) {
  const { mark, wordmark, full } = BRAND.logo;
  const load = priority ? ({ loading: "eager", fetchPriority: "high" } as const) : ({ loading: "lazy" } as const);
  if (variant === "full") return <img src={full.src} alt={BRAND.name} width={full.width} height={full.height} decoding="async" {...load} className={`w-auto ${className}`} />;
  if (variant === "mark") return <img src={mark.src} alt={BRAND.name} width={mark.width} height={mark.height} decoding="async" {...load} className={`w-auto ${className}`} />;
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <img src={mark.src} alt={BRAND.name} width={mark.width} height={mark.height} decoding="async" {...load} className="h-full w-auto" />
      <img src={wordmark.src} alt="" aria-hidden width={wordmark.width} height={wordmark.height} decoding="async" {...load} className="h-[62%] w-auto" />
    </span>
  );
}
