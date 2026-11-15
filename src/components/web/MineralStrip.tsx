"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

/**
 * The band under the home banner: each mineral as a small round picture with its name, drifting slowly sideways. It pauses while the pointer
 * or keyboard focus is on it, the arrows move it by hand, and each item leads to that mineral's page. Visitors who prefer less motion get a
 * strip they can scroll or step with the arrows, but it never moves by itself.
 */
export interface StripItem { name: string; href: string; image: string }

export function MineralStrip({ items }: { items: StripItem[] }) {
  const track = useRef<HTMLDivElement>(null);
  const paused = useRef(false);

  useEffect(() => {
    const el = track.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const tick = () => {
      if (!paused.current) {
        el.scrollLeft += 0.6;
        const unit = el.scrollWidth / 3;
        if (el.scrollLeft >= unit * 2) el.scrollLeft -= unit; // the list is repeated three times, so this jump cannot be seen
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const step = (dir: number) => {
    const el = track.current;
    if (!el) return;
    const unit = el.scrollWidth / 3;
    if (dir < 0 && el.scrollLeft < 320) el.scrollLeft += unit; // step back across the seam
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  const row = (copy: number) => items.map((m) => (
    <li key={`${copy}-${m.href}`} aria-hidden={copy > 0 || undefined} className="flex shrink-0 items-center">
      <Link href={m.href} tabIndex={copy > 0 ? -1 : undefined} className="group flex items-center gap-3 px-5 py-2.5 md:px-8">
        <img src={m.image} alt="" height={56} loading="lazy" decoding="async" className="h-8 w-auto max-w-[3.5rem] object-contain drop-shadow-[0_3px_4px_rgba(0,0,0,0.55)] transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-110 md:h-10 md:max-w-[4rem]" />
        <span className="whitespace-nowrap text-[13px] font-semibold text-white/90 transition-colors group-hover:text-gold-200 md:text-[15px]">{m.name}</span>
      </Link>
      <span aria-hidden className="h-6 w-px bg-white/25" />
    </li>
  ));

  return (
    <div className="relative bg-neutral-950" role="region" aria-label="Minerals we supply" onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }} onFocusCapture={() => { paused.current = true; }} onBlurCapture={() => { paused.current = false; }}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-gold-300 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-gold-300 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_140%_at_50%_50%,rgba(176,128,64,0.35),transparent_70%)]" />
      <button type="button" onClick={() => step(-1)} aria-label="Previous minerals" className="absolute left-2 top-1/2 z-20 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/60 text-gold-200 ring-1 ring-gold-400/40 transition hover:bg-gold-500 hover:text-ink md:left-4"><FaChevronLeft className="size-3.5" aria-hidden /></button>
      <button type="button" onClick={() => step(1)} aria-label="Next minerals" className="absolute right-2 top-1/2 z-20 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/60 text-gold-200 ring-1 ring-gold-400/40 transition hover:bg-gold-500 hover:text-ink md:right-4"><FaChevronRight className="size-3.5" aria-hidden /></button>
      <div ref={track} className="relative overflow-x-auto px-12 [-ms-overflow-style:none] [scrollbar-width:none] md:px-16 [&::-webkit-scrollbar]:hidden" style={{ maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
        <ul className="flex w-max items-center">{row(0)}{row(1)}{row(2)}</ul>
      </div>
    </div>
  );
}
