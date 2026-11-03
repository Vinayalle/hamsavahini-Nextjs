"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { FaArrowRight } from "react-icons/fa6";
import { Logo } from "@/components/brand/Logo";
import { fontVars } from "./fonts";

/** The longest the page waits for the video before it shows itself anyway (slow connections must never be locked out). */
const MAX_WAIT_MS = 7000;
const FADE_MS = 600;

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (notify: () => void) => { const m = window.matchMedia(REDUCED); m.addEventListener("change", notify); return () => m.removeEventListener("change", notify); };

/**
 * Home-page hero: a fixed message over a looping background video of a bulk carrier at sea (public/videos/hero.mp4, a CC0 clip, 3.8 MB). While the video loads, a full-page loader with the logo covers the whole page; it fades away as soon as the first frames can play,
 * on any error, or after a few seconds, whichever comes first. Visitors who ask for less motion get the still picture and no loader.
 */
export default function Hero() {
  const video = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<"loading" | "leaving" | "done">("loading");
  const still = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);

  useEffect(() => {
    if (still) return;
    const el = video.current;
    let finished = false;
    const finish = () => { if (!finished) { finished = true; setPhase("leaving"); } };
    if (el && el.readyState >= 3) finish();
    el?.addEventListener("canplay", finish);
    el?.addEventListener("error", finish);
    const timer = window.setTimeout(finish, MAX_WAIT_MS);
    return () => { el?.removeEventListener("canplay", finish); el?.removeEventListener("error", finish); window.clearTimeout(timer); };
  }, [still]);

  // The loader fades, then leaves the page; the page cannot scroll behind it while it is there.
  useEffect(() => {
    if (phase === "leaving") { const t = window.setTimeout(() => setPhase("done"), FADE_MS); return () => window.clearTimeout(t); }
  }, [phase]);
  const showLoader = !still && phase !== "done";
  useEffect(() => {
    if (!showLoader) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => { root.style.overflow = before; };
  }, [showLoader]);

  return (
    <>
    <section aria-labelledby="hero-title" className={`${fontVars} relative isolate flex w-full items-center justify-center overflow-hidden bg-neutral-950 text-white`} style={{ height: "calc(100svh - var(--site-header-h))", minHeight: 480 }}>
      {!still && (
        <video ref={video} autoPlay muted loop playsInline preload="auto" poster="/images/hero-poster.jpg" aria-hidden className="absolute inset-0 -z-20 size-full object-cover">
          <source src="/videos/hero.mp4" type="video/mp4" />
        </video>
      )}
      {still && <img src="/images/hero-poster.jpg" alt="" aria-hidden decoding="async" className="absolute inset-0 -z-20 size-full object-cover" />}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/45 to-black/70" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_45%,transparent,rgba(0,0,0,0.45))]" />

      <div className="mx-auto w-full max-w-4xl px-6 text-center">
        <h1 id="hero-title" className="text-[34px] font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
          Premium Minerals for
          <span className="shimmer-text mt-1 block">Industrial Excellence</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/85 md:text-lg md:leading-8">
          Leading supplier of high-grade iron ore, granite, quartz and industrial minerals from verified mines. Serving steel, glass, construction and power with reliable B2B supply.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/products" className="btn-sheen group inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-gold-400 to-gold-500 px-7 py-4 text-[15px] font-bold text-ink shadow-lg shadow-gold-500/30 transition hover:from-gold-300 hover:to-gold-400">
            Explore Products <FaArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </Link>
          <Link href="/request-a-quote" className="inline-flex items-center rounded-lg border border-white/25 bg-white/10 px-7 py-4 text-[15px] font-bold text-white backdrop-blur transition hover:border-gold-300 hover:bg-white/20">
            Request a Quote
          </Link>
        </div>
      </div>
    </section>

      {showLoader && (
        <div role="status" aria-live="polite" aria-label="Loading the page" data-loader
          className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-9 overflow-hidden bg-neutral-950 transition-opacity ease-out ${phase === "leaving" ? "opacity-0" : "opacity-100"}`}
          style={{ transitionDuration: `${FADE_MS}ms` }}>
          <div aria-hidden className="absolute left-1/2 top-1/2 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-500/15 blur-3xl" />
          <div className="relative flex justify-center"><Logo variant="full" onDark priority className="h-36 sm:h-48" /></div>
          <div aria-hidden className="relative h-[3px] w-44 overflow-hidden rounded-full bg-white/10"><span className="loader-bar absolute inset-y-0 w-1/2 rounded-full bg-gradient-to-r from-transparent via-gold-400 to-transparent" /></div>
          <noscript><style>{"[data-loader]{display:none!important}"}</style></noscript>
        </div>
      )}
    </>
  );
}
