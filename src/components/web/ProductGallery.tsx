"use client";

import { useState, type KeyboardEvent } from "react";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { LuPackage } from "react-icons/lu";

/**
 * Picture gallery of a product: one large picture, thumbnails underneath, previous/next buttons and the arrow keys.
 * Without pictures it shows a quiet placeholder, so the page never looks broken. The first picture is also in the server HTML.
 */
export default function ProductGallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [index, setIndex] = useState(0);
  const count = images.length;
  const go = (to: number) => setIndex((to + count) % count);
  const onKey = (e: KeyboardEvent) => {
    if (count < 2) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
  };

  if (count === 0) {
    return (
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] shadow-2xl shadow-black/40">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_70%_at_70%_20%,rgba(185,134,38,0.35),transparent_65%)]" />
        <div className="relative flex flex-col items-center gap-3 text-center">
          <span className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-gold-400 to-gold-700 text-white shadow-lg shadow-gold-500/30"><LuPackage className="size-9" aria-hidden /></span>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-gold-300">{name}</p>
        </div>
      </div>
    );
  }

  const active = images[index];
  return (
    <div role="group" aria-roledescription="carousel" aria-label={`Pictures of ${name}`} tabIndex={0} onKeyDown={onKey} className="group/gallery outline-none focus-visible:ring-4 focus-visible:ring-gold-500/40 rounded-[2rem]">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-neutral-900 shadow-2xl shadow-black/50 ring-1 ring-gold-500/20">
        <img key={active.url} src={active.url} alt={active.alt || name} width={1200} height={900} decoding="async" fetchPriority={index === 0 ? "high" : "auto"} className="aspect-[4/3] w-full animate-[hero-settle_700ms_ease-out_both] object-cover" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
        {count > 1 && (
          <>
            <button type="button" onClick={() => go(index - 1)} aria-label="Previous picture" className="absolute left-3 top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-lg transition hover:bg-gold-400 hover:text-ink md:opacity-0 md:group-hover/gallery:opacity-100 md:group-focus-within/gallery:opacity-100"><FaArrowLeft className="size-4" aria-hidden /></button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Next picture" className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-lg transition hover:bg-gold-400 hover:text-ink md:opacity-0 md:group-hover/gallery:opacity-100 md:group-focus-within/gallery:opacity-100"><FaArrowRight className="size-4" aria-hidden /></button>
            <p className="absolute bottom-3 right-4 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white backdrop-blur" aria-live="polite">{index + 1} / {count}</p>
          </>
        )}
      </div>
      {count > 1 && (
        <ul className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5">
          {images.map((g, i) => (
            <li key={g.url}>
              <button type="button" onClick={() => setIndex(i)} aria-label={`Show picture ${i + 1} of ${count}`} aria-current={i === index ? "true" : undefined} className={`block w-full cursor-pointer overflow-hidden rounded-xl border-2 transition ${i === index ? "border-gold-400 shadow-lg shadow-gold-500/20" : "border-white/10 opacity-70 hover:opacity-100"}`}>
                <img src={g.url} alt="" loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
