"use client";

import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

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
      <div ref={bar} className="h-full origin-left bg-gradient-to-r from-[var(--brand-red)] via-rose-400 to-amber-300" style={{ transform: "scaleX(0)" }} />
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
        <div ref={fill} className="h-full w-full origin-top bg-gradient-to-b from-[var(--brand-red)] via-rose-400 to-amber-300" style={{ transform: "scaleY(0)" }} />
      </div>
      {children}
    </div>
  );
}
