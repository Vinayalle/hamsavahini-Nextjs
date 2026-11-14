"use client";

import { useState } from "react";

/**
 * The picture beside a mineral's title: the first picture large in a gold frame, the others as small thumbnails on its corner.
 * Clicking a thumbnail swaps it with the large picture (the large one takes its place in the thumbnails).
 */
export function MineralVisual({ gallery }: { gallery: { src: string; alt: string }[] }) {
  const [order, setOrder] = useState(() => gallery.map((_, i) => i));
  const [main, ...rest] = order.map((i) => gallery[i]);
  const swap = (pos: number) => setOrder((o) => { const next = [...o]; [next[0], next[pos + 1]] = [next[pos + 1], next[0]]; return next; });

  return (
    <div className="relative mx-auto w-full max-w-[440px] pb-8 md:ml-auto md:mr-0">
      <div aria-hidden className="absolute -inset-3 -z-10 rotate-3 rounded-[2.25rem] bg-gradient-to-br from-gold-400/70 via-gold-500/30 to-transparent" />
      <figure className="about-bob group overflow-hidden rounded-[2rem] bg-neutral-900 shadow-2xl shadow-black/50 ring-1 ring-white/25">
        <img key={main.src} src={main.src} alt={main.alt} width={1000} height={1000} decoding="async" fetchPriority="high" className="aspect-square w-full animate-[hero-settle_550ms_ease-out_both] object-cover transition-transform duration-700 group-hover:scale-105" />
      </figure>
      {rest.length > 0 && (
        <ul className="absolute bottom-0 left-4 flex gap-3 md:-left-8">
          {rest.slice(0, 3).map((g, i) => (
            <li key={g.src}>
              <button type="button" onClick={() => swap(i)} aria-label={`Show this picture large: ${g.alt}`}
                className="block size-24 cursor-pointer overflow-hidden rounded-2xl bg-neutral-900 shadow-xl shadow-black/40 ring-4 ring-neutral-950 transition duration-300 hover:-translate-y-1 hover:ring-gold-400 focus-visible:outline-none focus-visible:ring-gold-400 sm:size-28">
                <img src={g.src} alt="" width={400} height={400} loading="lazy" decoding="async" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
