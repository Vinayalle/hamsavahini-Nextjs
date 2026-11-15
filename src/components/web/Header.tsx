"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaArrowRight } from "react-icons/fa";
import { LuChevronDown, LuMenu, LuX } from "react-icons/lu";
import { NAV, type NavItem } from "@/content/site";
import { fontVars } from "./fonts";
import { Logo } from "@/components/brand/Logo";

/**
 * Site header. Height is fixed to --site-header-h (89px, border included) because the hero sections are sized as "screen height minus header".
 * Dropdowns open on hover and on click/Enter, close on Escape, outside click, focus leaving and navigation.
 */
const linkBase = "text-[15px] font-medium transition-colors";

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const bar = useRef<HTMLElement>(null);

  // Close everything after a navigation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (bar.current && !bar.current.contains(e.target as Node)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(null); setMobileOpen(false); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);

  const isActive = (item: NavItem) => {
    const roots = [item.href, ...(item.children?.map((c) => c.href) ?? [])].filter(Boolean).map((h) => (h as string).split("#")[0]);
    return roots.some((r) => r !== "/" && (pathname === r || pathname.startsWith(`${r}/`)));
  };

  return (
    <header ref={bar} className={`${fontVars} sticky top-0 z-50 w-full border-b border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:shadow-lg">Skip to content</a>
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-10">
        <div className="flex h-[calc(var(--site-header-h)-1px)] items-center justify-between gap-4 2xl:gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Hamsavahin Aarth Mines, home">
            <Logo variant="lockup" priority className="h-12 sm:h-14 2xl:h-16" />
          </Link>

          {/* desktop */}
          <nav aria-label="Main" className="hidden min-w-0 items-center gap-0.5 xl:flex 2xl:gap-2">
            {NAV.map((item) => {
              const active = isActive(item);
              if (!item.children) {
                return (
                  <Link key={item.label} href={item.href ?? "/"} aria-current={active ? "page" : undefined} className={`${linkBase} whitespace-nowrap rounded-lg px-2.5 py-2 2xl:px-4 ${active ? "text-gold-700" : "text-neutral-800 hover:text-gold-700"}`}>{item.label}</Link>
                );
              }
              const expanded = open === item.label;
              return (
                <div key={item.label} className="relative" onMouseEnter={() => setOpen(item.label)} onMouseLeave={() => setOpen(null)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(null); }}>
                  <button type="button" aria-expanded={expanded} aria-haspopup="menu" onClick={() => setOpen(expanded ? null : item.label)} className={`${linkBase} flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 2xl:px-4 ${active || expanded ? "text-gold-700" : "text-neutral-800 hover:text-gold-700"}`}>
                    {item.label}
                    <LuChevronDown className={`size-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                  <div className={`absolute left-1/2 top-full -translate-x-1/2 pt-4 transition-all duration-200 ${item.wide ? "w-[min(720px,90vw)]" : "w-[320px]"} ${expanded ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"}`}>
                    <div className={`rounded-2xl border border-neutral-200 bg-white p-2 shadow-[0_20px_60px_rgba(0,0,0,0.14)] ${item.wide ? "grid grid-cols-2 gap-1" : ""}`}>
                      {item.children.map((child) => (
                        <Link key={child.href + child.label} href={child.href} tabIndex={expanded ? 0 : -1} className="group flex items-start gap-3 rounded-xl px-3.5 py-3 transition-colors hover:bg-neutral-50 focus-visible:bg-neutral-50">
                          {child.icon && <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold-50 text-gold-700 transition-colors group-hover:bg-gold-500 group-hover:text-white"><child.icon className="size-[18px]" /></span>}
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-neutral-900 group-hover:text-gold-700">{child.label}</span>
                            {child.description && <span className="mt-0.5 block text-xs leading-5 text-neutral-500">{child.description}</span>}
                          </span>
                          <FaArrowRight className="mt-1.5 size-3 shrink-0 text-neutral-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-gold-700" aria-hidden />
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="hidden shrink-0 items-center gap-3 xl:flex">
            <Link href="/contact-us" className="btn-sheen group flex h-11 items-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-b from-gold-400 to-gold-500 px-4 text-sm font-bold text-ink shadow-md shadow-gold-500/25 transition hover:-translate-y-0.5 hover:from-gold-300 hover:to-gold-400 hover:shadow-lg hover:shadow-gold-500/30 2xl:px-5">
              Contact us
              <FaArrowRight className="size-3 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
            </Link>
          </div>

          <button type="button" aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen} aria-controls="mobile-menu" onClick={() => setMobileOpen((v) => !v)} className="flex size-11 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 text-neutral-800 xl:hidden">
            {mobileOpen ? <LuX className="size-6" aria-hidden /> : <LuMenu className="size-6" aria-hidden />}
          </button>
        </div>
      </div>

      {/* mobile */}
      <div id="mobile-menu" className={`border-t border-neutral-200 bg-white xl:hidden ${mobileOpen ? "block" : "hidden"}`}>
        <div className="max-h-[calc(100svh-var(--site-header-h))] overflow-y-auto px-5 py-4">
          {NAV.map((item) => (
            <div key={item.label} className="border-b border-neutral-100">
              {item.children ? (
                <>
                  <button type="button" aria-expanded={mobileSection === item.label} onClick={() => setMobileSection(mobileSection === item.label ? null : item.label)} className="flex w-full cursor-pointer items-center justify-between py-4 text-left text-[16px] font-medium text-neutral-900">
                    {item.label}
                    <LuChevronDown className={`size-5 transition-transform ${mobileSection === item.label ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                  {mobileSection === item.label && (
                    <ul className="pb-3 pl-2">
                      {item.children.map((child) => (
                        <li key={child.href + child.label}><Link href={child.href} className="block rounded-lg px-3 py-2.5 text-[15px] text-neutral-700 hover:bg-neutral-50 hover:text-gold-700">{child.label}</Link></li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <Link href={item.href ?? "/"} className="block py-4 text-[16px] font-medium text-neutral-900">{item.label}</Link>
              )}
            </div>
          ))}
          <div className="grid gap-3 py-5">
            <Link href="/contact-us" className="rounded-lg bg-gold-500 px-6 py-3.5 text-center text-[15px] font-bold text-ink">Contact us</Link>
            <Link href="/request-a-quote" className="rounded-lg border border-gold-600 px-6 py-3.5 text-center text-[15px] font-bold text-gold-700">Request a quote</Link>
          </div>
        </div>
      </div>
    </header>
  );
}
