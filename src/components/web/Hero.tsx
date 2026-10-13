"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Aldrich, Play, Roboto } from "next/font/google";
import type { HeroSlide } from "@/server/services/site";

// Fonts taken from the reference site (self-hosted at build time by next/font, so no external font request): headline Aldrich,
// paragraph Play, button Roboto.
const aldrich = Aldrich({ subsets: ["latin"], weight: "400", display: "swap", variable: "--font-hero-title" });
const play = Play({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--font-hero-text" });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500"], display: "swap", variable: "--font-hero-button" });

const AUTOPLAY_MS = 3000;
const TRANSITION_MS = 700;
const SWIPE_MIN_PX = 50;
const SWIPE_FRACTION = 0.15;

interface TrackItem {
  slide: HeroSlide;
  key: string;
  /** Index of the real slide this entry shows (clones show the slide they copy). */
  real: number;
  clone: boolean;
}

/**
 * Home-page hero: a responsive, editor-controlled slider.
 *  - Height is exactly the viewport minus the navbar (`--site-header-h`); `svh` keeps it stable under mobile browser toolbars.
 *    A 440px floor only applies on very short screens (landscape phones) so the text is never clipped.
 *  - Desktop: the picture fills the slide and a glassy red panel covers its right half, holding the text.
 *    Phone: the picture on top, the red text panel across the bottom.
 *  - Two or more slides ALWAYS advance on their own every 3 seconds, and always move the same way (right to left): after the last
 *    slide comes the first again, without rewinding. This is done with a copy of the last slide before the first and a copy of the
 *    first after the last; when the track lands on a copy it jumps, without animation, to the identical real slide.
 *  - Visitors can drag (mouse) or swipe (touch) the slider at any time, click a dot, or use the arrow keys. A manual change
 *    restarts the 3-second timer.
 *  - The text rises into place when the page opens and every time a slide becomes the active one.
 */
export default function Hero({ slides }: { slides: HeroSlide[] }) {
  const items: HeroSlide[] = slides.length ? slides : [FALLBACK];
  const n = items.length;
  const many = n > 1;
  const track: TrackItem[] = many
    ? [{ slide: items[n - 1], key: "head", real: n - 1, clone: true }, ...items.map((slide, real) => ({ slide, key: slide.id, real, clone: false })), { slide: items[0], key: "tail", real: 0, clone: true }]
    : items.map((slide, real) => ({ slide, key: slide.id, real, clone: false }));

  const [v, setV] = useState(many ? 1 : 0); // position on the track (1..n are the real slides)
  const [animate, setAnimate] = useState(true);
  const [dragX, setDragX] = useState<number | null>(null); // pixels while the visitor is dragging
  const [manual, setManual] = useState(0); // bumps on every manual change to restart the timer
  const dragging = useRef(false);
  const suppressClick = useRef(false);
  const section = useRef<HTMLElement>(null);

  // If the editor changed the number of slides while the page was open, never point past the end of the track.
  const pos = Math.min(Math.max(v, 0), track.length - 1);
  const real = many ? (((pos - 1) % n) + n) % n : 0;

  // Not clamped here: `pos` above clamps what is shown, and the jump back from a copy resets `v` to a real slide.
  const advance = () => setV((c) => c + 1);
  const retreat = () => setV((c) => Math.max(c - 1, 0));
  const touched = () => setManual((m) => m + 1);

  // Autoplay: always on for 2+ slides. Skips a tick only while the visitor is holding the slider.
  useEffect(() => {
    if (!many) return;
    const t = window.setInterval(() => {
      if (!dragging.current) setV((c) => c + 1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(t);
  }, [many, manual]);

  // Landed on a copy: after the slide animation, jump (no animation) to the identical real slide. This is what makes the loop seamless.
  useEffect(() => {
    if (!many || (pos !== 0 && pos !== n + 1)) return;
    const target = pos === 0 ? n : 1;
    const t = window.setTimeout(() => {
      setAnimate(false);
      setV(target);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    }, TRANSITION_MS + 30);
    return () => window.clearTimeout(t);
  }, [pos, n, many]);

  function onPointerDown(e: React.PointerEvent) {
    if (!many || (e.pointerType === "mouse" && e.button !== 0)) return;
    if ((e.target as HTMLElement).closest("button")) return; // the dots handle their own clicks
    const startX = e.clientX;
    const width = section.current?.clientWidth || 1;
    let moved = false;
    dragging.current = true;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) > 5) moved = true;
      if (moved) setDragX(dx);
    };
    const finish = (dx: number) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      dragging.current = false;
      setDragX(null);
      if (!moved) return;
      suppressClick.current = true; // a drag must not also "click" the link under the pointer
      window.setTimeout(() => { suppressClick.current = false; }, 0);
      if (Math.abs(dx) > Math.max(SWIPE_MIN_PX, width * SWIPE_FRACTION)) (dx < 0 ? advance : retreat)();
      touched();
    };
    const up = (ev: PointerEvent) => finish(ev.clientX - startX);
    const cancel = () => finish(0);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }

  return (
    <section
      ref={section}
      aria-roledescription="carousel"
      aria-label="Featured"
      className={`${aldrich.variable} ${play.variable} ${roboto.variable} relative w-full touch-pan-y select-none overflow-hidden bg-neutral-200 text-white ${many ? (dragX !== null ? "cursor-grabbing" : "cursor-grab") : ""}`}
      style={{ height: "calc(100svh - var(--site-header-h))", minHeight: 440 }}
      onPointerDown={onPointerDown}
      onClickCapture={(e) => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); } }}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowRight") { advance(); touched(); }
        if (e.key === "ArrowLeft") { retreat(); touched(); }
      }}
    >
      <div
        className="flex h-full ease-out"
        style={{
          transform: `translateX(calc(${-pos * 100}% + ${dragX ?? 0}px))`,
          transition: animate && dragX === null ? `transform ${TRANSITION_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)` : "none",
        }}
        aria-live="off"
      >
        {track.map((t) => {
          const current = t.real === real; // a copy and its original are "current" together, so nothing replays when the track jumps
          return <Slide key={t.key} slide={t.slide} number={t.real} total={n} current={current} hidden={t.clone || !current} firstHeading={!t.clone && t.real === 0} />;
        })}
      </div>

      {many && (
        <div className="absolute inset-x-0 bottom-4 z-10 flex items-center justify-center gap-2 md:inset-x-auto md:bottom-[clamp(2rem,10vh,6rem)] md:left-1/2 md:justify-start md:pl-[clamp(2rem,5vw,6rem)]" role="group" aria-label="Choose slide">
          {items.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setV(i + 1); touched(); }}
              aria-label={`Show slide ${i + 1} of ${n}`}
              aria-current={i === real}
              className={`h-2.5 cursor-pointer rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${i === real ? "w-[52px] bg-white" : "w-2.5 bg-white/60 hover:bg-white/90"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Slide({ slide, number, total, current, hidden, firstHeading }: { slide: HeroSlide; number: number; total: number; current: boolean; hidden: boolean; firstHeading: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!slide.imageUrl && !imageFailed;
  const Title = firstHeading ? "h1" : "h2";
  return (
    <div role="group" aria-roledescription="slide" aria-label={`${number + 1} of ${total}`} aria-hidden={hidden} inert={hidden} className="relative h-full w-full shrink-0 overflow-hidden">
      {showImage && (
        // A plain <img>: the picture is a same-origin, editor-uploaded file served by our own route (no external optimiser to allow in the CSP).
        <img src={slide.imageUrl!} alt="" decoding="async" draggable={false} fetchPriority={number === 0 ? "high" : "auto"} onError={() => setImageFailed(true)} className={`absolute inset-0 size-full object-cover ${current ? "hero-settle" : ""}`} />
      )}

      {/* Text panel: bottom sheet on phones, right half on desktop. The red layer is glassy: the photo shows through it. */}
      <div className="absolute inset-x-0 bottom-0 flex max-h-[75%] flex-col items-center justify-center px-6 pb-14 pt-8 text-center md:inset-y-0 md:left-1/2 md:right-0 md:max-h-none md:items-start md:px-[clamp(2rem,5vw,6rem)] md:pb-16 md:pt-0 md:text-left">
        {showImage ? (
          <>
            <div aria-hidden className="absolute inset-0 bg-[var(--brand-red)]/70" />
            <div aria-hidden className="absolute inset-0 bg-[var(--brand-red)]/40 mix-blend-multiply" />
          </>
        ) : (
          <div aria-hidden className="absolute inset-0 bg-[var(--brand-red)]" />
        )}
        {/* Sizes on a phone follow the reference exactly: 24px headline, 16px text, 15px button with 16px padding, a 280px text column. */}
        <div className={`relative flex w-full max-w-[280px] flex-col items-center gap-3 transition-opacity duration-500 md:max-w-2xl md:items-start md:gap-6 ${current ? "opacity-100" : "opacity-0"}`}>
          <Title className={`line-clamp-3 font-[family-name:var(--font-hero-title)] text-[24px] font-normal leading-8 md:line-clamp-4 md:text-[clamp(2.25rem,4.2vw,4.5rem)] md:leading-[1.12] ${current ? "hero-rise" : ""}`} style={current ? { animationDelay: "120ms" } : undefined}>{slide.title}</Title>
          {slide.description && (
            <p className={`line-clamp-3 font-[family-name:var(--font-hero-text)] text-base leading-6 md:line-clamp-4 md:text-[clamp(1.05rem,1.6vw,1.6rem)] md:leading-snug ${current ? "hero-rise" : ""}`} style={current ? { animationDelay: "300ms" } : undefined}>{slide.description}</p>
          )}
          {slide.linkUrl && <SlideLink href={slide.linkUrl} label={slide.linkLabel || "Know more"} className={current ? "hero-rise" : ""} delay={current ? "480ms" : undefined} />}
        </div>
      </div>
    </div>
  );
}

function SlideLink({ href, label, className, delay }: { href: string; label: string; className: string; delay?: string }) {
  const cls = `mt-1 inline-flex cursor-pointer items-center rounded-lg bg-white p-4 font-[family-name:var(--font-hero-button)] text-[15px] font-normal leading-[1.1] text-black shadow-sm transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:mt-2 md:px-7 ${className}`;
  const style = delay ? { animationDelay: delay } : undefined;
  // Only same-site paths use the client router; absolute links open normally and cannot reach the opener window.
  return href.startsWith("/") ? <Link href={href} draggable={false} className={cls} style={style}>{label}</Link> : <a href={href} draggable={false} rel="noopener noreferrer" className={cls} style={style}>{label}</a>;
}

/** Shown only until an editor publishes the first banner, so the home page is never blank. */
const FALLBACK: HeroSlide = { id: "default", title: "Hamsavahin", description: "Global minerals and metals sourcing, trading and supply.", imageUrl: null, linkUrl: "", linkLabel: "" };
