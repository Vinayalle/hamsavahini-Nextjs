import { BRAND } from "@/config/brand";

/**
 * The company logo. One component for every place it appears. The logo always keeps its own colours (deep browns and golds).
 *
 *   variant="mark"     the swan and lotus only (tab icons, collapsed sidebar, small spaces)
 *   variant="lockup"   the mark and the HAMSAVAHIN name side by side (website header and footer, admin sidebar)
 *   variant="full"     the complete stacked logo (sign-in pages, hero areas)
 *
 * Size it with a height class, for example `className="h-12"` or `className="h-11 sm:h-14"`; the width follows the artwork.
 * For a lockup the height is the height of the whole logo (the mark); the name is drawn at 62% of it.
 * `onDark`: the browns of the logo disappear on a dark surface, so it is shown on a rounded cream tile instead of changing its colours.
 * The intrinsic width and height of every picture are set, so nothing jumps while it loads.
 * The text alternative sits on the first picture; the name beside it is decorative.
 */
export function Logo({ variant = "lockup", priority = false, className = "h-12", onDark = false }: { variant?: "mark" | "lockup" | "full"; priority?: boolean; className?: string; onDark?: boolean }) {
  const { mark, wordmark, full } = BRAND.logo;
  const load = priority ? ({ loading: "eager", fetchPriority: "high" } as const) : ({ loading: "lazy" } as const);
  const art =
    variant === "full" ? <img src={full.src} alt={BRAND.name} width={full.width} height={full.height} decoding="async" {...load} className={`w-auto ${onDark ? "h-full" : className}`} />
    : variant === "mark" ? <img src={mark.src} alt={BRAND.name} width={mark.width} height={mark.height} decoding="async" {...load} className={`w-auto ${onDark ? "h-full" : className}`} />
    : (
      <span className={`inline-flex items-center gap-3 ${onDark ? "h-full" : className}`}>
        <img src={mark.src} alt={BRAND.name} width={mark.width} height={mark.height} decoding="async" {...load} className="h-full w-auto" />
        <img src={wordmark.src} alt="" aria-hidden width={wordmark.width} height={wordmark.height} decoding="async" {...load} className="h-[62%] w-auto" />
      </span>
    );
  if (!onDark) return art;
  return <span className={`inline-flex w-fit self-start items-center rounded-2xl bg-[#fbf5ea] p-2.5 shadow-lg shadow-black/25 ring-1 ring-gold-300/40 ${className}`}>{art}</span>;
}
