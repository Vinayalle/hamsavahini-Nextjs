"use client";

import { useEffect, useState } from "react";
import { INDUSTRIES } from "@/content/site";

/**
 * A bar that stays under the site header while the visitor reads the industries. It lights up the industry that is on screen, and a click
 * glides to that industry. (The icons come from the same list the page uses, so nothing is passed in.)
 */
export function IndustryNav() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = INDUSTRIES.map((i) => document.getElementById(i.slug)).filter((e): e is HTMLElement => !!e);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) setActive(e.target.id); },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  const go = (slug: string) => {
    const el = document.getElementById(slug);
    if (!el) return;
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  return (
    <nav aria-label="Industries" className="sticky top-[var(--site-header-h)] z-30 border-b border-gold-600/20 bg-neutral-950/90 backdrop-blur-md">
      <ul className="mx-auto flex max-w-[1200px] gap-2 overflow-x-auto px-5 py-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:justify-center sm:px-8 [&::-webkit-scrollbar]:hidden">
        {INDUSTRIES.map((i) => {
          const on = active === i.slug;
          return (
            <li key={i.slug} className="shrink-0">
              <a href={`#${i.slug}`} onClick={(e) => { e.preventDefault(); go(i.slug); }} aria-current={on ? "true" : undefined}
                className={`group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition duration-300 ${on ? "border-gold-400 bg-gold-500 text-ink shadow-lg shadow-gold-500/30" : "border-white/15 bg-white/5 text-white/80 hover:border-gold-400/60 hover:bg-white/10 hover:text-white"}`}>
                <i.icon className={`size-4 transition-transform duration-300 group-hover:scale-125 ${on ? "text-ink" : "text-gold-300"}`} aria-hidden />
                {i.name}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
