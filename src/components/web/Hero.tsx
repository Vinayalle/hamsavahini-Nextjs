"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Chakra_Petch } from "next/font/google";
import type { HeroSlide } from "@/server/services/site";

const heading = Chakra_Petch({ subsets: ["latin"], weight: ["300", "400", "500", "600"], display: "swap" });

const AUTOPLAY_MS = 6000;
const SWIPE_PX = 50;

/**
 * Home-page hero: a responsive, editor-controlled slider.
 *  - Height is exactly the viewport minus the navbar (`--site-header-h`); `svh` keeps it stable under mobile browser toolbars.
 *    A 440px floor only applies on very short screens (landscape phones) so the text is never clipped.
 *  - Desktop: the picture fills the slide and a brand-red panel multiplies over its right half, holding the text.
 *    Phone: the picture on top, the red text panel across the bottom.
 *  - One slide shows no controls. Several slides autoplay and pause on hover/focus/hidden tab,
 *    swiped, driven by the arrow keys, and never autoplay when the visitor prefers reduced motion.
 */
export default function Hero({ slides }: { slides: HeroSlide[] }) {
  const items: HeroSlide[] = slides.length ? slides : [FALLBACK];
  const many = items.length > 1;
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback((to: number) => setIndex(((to % items.length) + items.length) % items.length), [items.length]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    const vis = () => setTabHidden(document.hidden);
    sync();
    mq.addEventListener("change", sync);
    document.addEventListener("visibilitychange", vis);
    return () => { mq.removeEventListener("change", sync); document.removeEventListener("visibilitychange", vis); };
  }, []);

  // If the editor removed slides while the page was open, never point past the end.
  const active = Math.min(index, items.length - 1);
  const playing = many && !hovering && !reducedMotion && !tabHidden;
  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % items.length), AUTOPLAY_MS);
    return () => window.clearInterval(t);
  }, [playing, items.length, active]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured"
      className={`relative w-full overflow-hidden bg-neutral-200 text-white ${heading.className}`}
      style={{ height: "calc(100svh - var(--site-header-h))", minHeight: 440 }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setHovering(true)}
      onBlurCapture={() => setHovering(false)}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowRight") go(active + 1);
        if (e.key === "ArrowLeft") go(active - 1);
      }}
      onTouchStart={(e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; }}
      onTouchEnd={(e) => {
        const s = touch.current;
        touch.current = null;
        if (!s || !many) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - s.x;
        if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(t.clientY - s.y)) go(active + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="flex h-full transition-transform duration-700 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${active * 100}%)` }} aria-live={playing ? "off" : "polite"}>
        {items.map((slide, i) => (
          <Slide key={slide.id} slide={slide} position={i} total={items.length} current={i === active} />
        ))}
      </div>

      {many && (
        <div className="absolute inset-x-0 bottom-4 z-10 flex items-center justify-center gap-3 md:inset-x-auto md:bottom-8 md:left-1/2 md:justify-start md:pl-[clamp(2rem,5vw,6rem)]">
          <div className="flex items-center gap-2" role="group" aria-label="Choose slide">
            {items.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show slide ${i + 1} of ${items.length}`}
                aria-current={i === active}
                className={`h-2.5 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none ${i === active ? "w-[52px] bg-white" : "w-2.5 bg-white/60 hover:bg-white/90"}`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Slide({ slide, position, total, current }: { slide: HeroSlide; position: number; total: number; current: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!slide.imageUrl && !imageFailed;
  const Title = position === 0 ? "h1" : "h2";
  return (
    <div role="group" aria-roledescription="slide" aria-label={`${position + 1} of ${total}`} aria-hidden={!current} inert={!current} className="relative h-full w-full shrink-0 overflow-hidden">
      {showImage && (
        // A plain <img>: the picture is a same-origin, editor-uploaded file served by our own route (no external optimiser to allow in the CSP).
        <img src={slide.imageUrl!} alt="" decoding="async" loading={position === 0 ? "eager" : "lazy"} fetchPriority={position === 0 ? "high" : "auto"} onError={() => setImageFailed(true)} className="absolute inset-0 size-full object-cover" />
      )}

      {/* Text panel: bottom sheet on phones, right half on desktop. The red layer multiplies over the picture so its texture shows through. */}
      <div className="absolute inset-x-0 bottom-0 flex max-h-[75%] flex-col items-center justify-center px-6 pb-14 pt-8 text-center md:inset-y-0 md:left-1/2 md:right-0 md:max-h-none md:items-start md:px-[clamp(2rem,5vw,6rem)] md:pb-16 md:pt-0 md:text-left">
        {showImage ? (
          // Glassy red: a translucent red wash plus a light multiply, so the photo stays clearly visible through the panel.
          <>
            <div aria-hidden className="absolute inset-0 bg-[var(--brand-red)]/70" />
            <div aria-hidden className="absolute inset-0 bg-[var(--brand-red)]/40 mix-blend-multiply" />
          </>
        ) : (
          <div aria-hidden className="absolute inset-0 bg-[var(--brand-red)]" />
        )}
        <div className={`relative flex max-w-2xl flex-col items-center gap-3 transition-all duration-700 motion-reduce:transition-none md:items-start md:gap-6 ${current ? "translate-y-0 opacity-100 delay-200" : "translate-y-4 opacity-0"}`}>
          <Title className="line-clamp-3 text-balance text-[clamp(1.6rem,6.5vw,2.25rem)] font-medium leading-[1.12] md:line-clamp-4 md:text-[clamp(2.25rem,4.2vw,4.5rem)]">{slide.title}</Title>
          {slide.description && <p className="line-clamp-3 text-[clamp(0.95rem,3.6vw,1.05rem)] font-light leading-snug md:line-clamp-4 md:text-[clamp(1.05rem,1.6vw,1.6rem)]">{slide.description}</p>}
          {slide.linkUrl && <SlideLink href={slide.linkUrl} label={slide.linkLabel || "Know more"} />}
        </div>
      </div>
    </div>
  );
}

function SlideLink({ href, label }: { href: string; label: string }) {
  const cls = "mt-1 inline-flex items-center rounded-lg bg-white px-6 py-3 text-base font-medium text-neutral-900 shadow-sm transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:mt-2 md:px-7 md:py-3.5";
  // Only same-site paths use the client router; absolute links open normally and cannot reach the opener window.
  return href.startsWith("/") ? <Link href={href} className={cls}>{label}</Link> : <a href={href} rel="noopener noreferrer" className={cls}>{label}</a>;
}

/** Shown only until an editor publishes the first banner, so the home page is never blank. */
const FALLBACK: HeroSlide = { id: "default", title: "Hamsavahin", description: "Global minerals and metals sourcing, trading and supply.", imageUrl: null, linkUrl: "", linkLabel: "" };
