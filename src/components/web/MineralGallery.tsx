"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LuChevronLeft, LuChevronRight, LuMaximize2, LuX } from "react-icons/lu";
import { Reveal } from "./motion";

/**
 * The pictures of a mineral, shown whole (never cropped) in a grid. Clicking one opens it large over the page; the arrow keys, the buttons
 * and a swipe move between pictures, and Escape or a click outside closes it.
 */
export interface GalleryItem { src: string; alt: string }

export function MineralGallery({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const n = items.length;

  const show = (i: number, el: HTMLElement) => { opener.current = el; setOpen(i); };
  const close = useCallback(() => { setOpen(null); opener.current?.focus(); }, []);
  const go = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + n) % n)), [n]);

  useEffect(() => {
    if (open === null) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => { root.style.overflow = before; window.removeEventListener("keydown", onKey); };
  }, [open, close, go]);

  const cols = n === 1 ? "grid-cols-1 max-w-xl mx-auto" : n === 2 || n === 4 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <>
      <ul className={`grid gap-5 md:gap-7 ${cols}`}>
        {items.map((g, i) => (
          <Reveal key={g.src} as="li" variant="scale" delay={(i % 3) * 110}>
            <button type="button" onClick={(e) => show(i, e.currentTarget)} aria-label={`View larger: ${g.alt}`}
              className="group relative block w-full cursor-zoom-in overflow-hidden rounded-3xl bg-neutral-900 text-left shadow-xl shadow-neutral-900/15 ring-1 ring-black/5 transition duration-500 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-gold-500/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold-500/50">
              <img src={g.src} alt={g.alt} width={1000} height={1000} loading="lazy" decoding="async" className="aspect-square w-full object-contain transition-transform duration-700 group-hover:scale-[1.04]" />
              <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span aria-hidden className="absolute bottom-4 right-4 flex size-10 items-center justify-center rounded-full bg-gold-500 text-ink opacity-0 shadow-lg transition duration-300 group-hover:opacity-100"><LuMaximize2 className="size-4" /></span>
            </button>
          </Reveal>
        ))}
      </ul>

      {open !== null && (
        <div role="dialog" aria-modal="true" aria-label={items[open].alt} onClick={close}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { const s = touchX.current; touchX.current = null; if (s !== null && Math.abs(e.changedTouches[0].clientX - s) > 60) go(e.changedTouches[0].clientX < s ? 1 : -1); }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-neutral-950/92 p-4 backdrop-blur-sm sm:p-8">
          <button ref={closeBtn} type="button" onClick={close} aria-label="Close" className="absolute right-4 top-4 flex size-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"><LuX className="size-5" aria-hidden /></button>
          {n > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous picture" className="absolute left-3 top-1/2 flex size-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-gold-500 hover:text-ink sm:left-6"><LuChevronLeft className="size-6" aria-hidden /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next picture" className="absolute right-3 top-1/2 flex size-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-gold-500 hover:text-ink sm:right-6"><LuChevronRight className="size-6" aria-hidden /></button>
            </>
          )}
          <figure onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full">
            <img key={items[open].src} src={items[open].src} alt={items[open].alt} className="max-h-[84vh] w-auto max-w-full animate-[hero-settle_500ms_ease-out_both] rounded-2xl object-contain shadow-2xl shadow-black/60" />
            <figcaption className="mt-3 text-center text-sm text-white/75">{items[open].alt}{n > 1 ? ` · ${open + 1} / ${n}` : ""}</figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
