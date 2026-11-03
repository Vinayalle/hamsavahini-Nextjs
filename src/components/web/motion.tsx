"use client";

import { createElement, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

type RevealVariant = "up" | "left" | "right" | "scale" | "bar";
type RevealTag = "div" | "li" | "section" | "article" | "p" | "span";

/**
 * Fades an element in when it scrolls into view (once). `delay` (ms) staggers siblings. The animation is plain CSS (see globals.css,
 * `[data-reveal]`), so it respects prefers-reduced-motion there, and the content is always in the page HTML for search engines.
 */
export function Reveal({
  children, className, delay = 0, variant = "up", as = "div",
}: { children?: ReactNode; className?: string; delay?: number; variant?: RevealVariant; as?: RevealTag }) {
  const [node, setNode] = useState<HTMLElement | null>(null); // a callback ref, so the observer starts once the element exists
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setShown(true)); // very old browsers: just show it
      return () => cancelAnimationFrame(frame);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node]);
  return createElement(as, { ref: setNode, className, "data-reveal": variant, "data-in": shown ? "true" : "false", style: { "--d": `${delay}ms` } as CSSProperties }, children);
}

/** Thin brand-coloured bar at the very top of the window that fills as the visitor reads down the page. */
export function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, doc.scrollTop / max) : 0})`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]">
      <div ref={bar} className="h-full origin-left bg-gradient-to-r from-gold-400 via-gold-400 to-gold-300" style={{ transform: "scaleX(0)" }} />
    </div>
  );
}

/** A vertical line behind a list of steps that fills with colour as the visitor scrolls through them. */
export function TimelineRail({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = root.current;
      if (!el || !fill.current) return;
      const rect = el.getBoundingClientRect();
      const progress = (window.innerHeight * 0.62 - rect.top) / rect.height;
      fill.current.style.transform = `scaleY(${Math.max(0, Math.min(1, progress))})`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div ref={root} className={`relative ${className ?? ""}`}>
      <div aria-hidden className="absolute bottom-4 left-6 top-4 w-px bg-neutral-200 md:left-8">
        <div ref={fill} className="h-full w-full origin-top bg-gradient-to-b from-gold-400 via-gold-400 to-gold-300" style={{ transform: "scaleY(0)" }} />
      </div>
      {children}
    </div>
  );
}

/**
 * A number that counts up from 0 the first time it scrolls into view. The final number is in the page HTML (search engines, no JavaScript,
 * and visitors who prefer reduced motion all see it at once); the counting is only decoration.
 */
export function CountUp({ to, suffix = "", duration = 1600 }: { to: number; suffix?: string; duration?: number }) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [value, setValue] = useState(to);
  useEffect(() => {
    if (!node || typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - start) / duration);
        setValue(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(node);
    return () => { io.disconnect(); cancelAnimationFrame(frame); };
  }, [node, to, duration]);
  return <span ref={setNode}><span aria-hidden>{value.toLocaleString("en-US")}{suffix}</span><span className="sr-only">{to.toLocaleString("en-US")}{suffix}</span></span>;
}

/**
 * Leans a card towards the pointer and lets a soft light follow it. Only for devices with a real mouse and visitors who have not asked for
 * less motion; everywhere else it is a plain box.
 */
export function Tilt({ children, className = "", max = 6 }: { children: ReactNode; className?: string; max?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const allowed = () => window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches;
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = box.current;
    if (!el || !allowed()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
    el.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${((y + 0.5) * 100).toFixed(1)}%`);
  };
  const leave = () => { if (box.current) box.current.style.transform = ""; };
  return <div ref={box} onPointerMove={move} onPointerLeave={leave} className={`tilt ${className}`}>{children}</div>;
}
