"use client";

import Link from "next/link";
import { useState } from "react";
import { FaArrowRight } from "react-icons/fa";
import { COMMODITIES, COMMODITY_CATEGORIES, type CommodityCategory } from "@/content/photos";
import { Reveal } from "./motion";

/**
 * The company's full commodity range as pictures, with tabs to show one group at a time. Every picture leads to a quote request for that
 * commodity. The pictures already carry their own labels, so the name is only repeated in a small bar for accessibility and for the pictures
 * (such as rice) that have none.
 */
export function CommodityCatalogue() {
  const [group, setGroup] = useState<CommodityCategory | "All">("All");
  const shown = COMMODITIES.filter((c) => group === "All" || c.category === group);
  const tabs: (CommodityCategory | "All")[] = ["All", ...COMMODITY_CATEGORIES];
  return (
    <div>
      <div role="tablist" aria-label="Commodity groups" className="-mx-1 mb-8 flex gap-2 overflow-x-auto px-1 pb-2 sm:flex-wrap sm:justify-center sm:overflow-visible">
        {tabs.map((t) => {
          const on = group === t;
          const n = t === "All" ? COMMODITIES.length : COMMODITIES.filter((c) => c.category === t).length;
          return (
            <button key={t} type="button" role="tab" aria-selected={on} onClick={() => setGroup(t)}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${on ? "border-gold-500 bg-gold-500 text-ink shadow-lg shadow-gold-500/25" : "border-neutral-200 bg-white text-neutral-700 hover:border-gold-300 hover:text-gold-700"}`}>
              {t}<span className={`rounded-full px-2 py-0.5 text-xs ${on ? "bg-ink/15" : "bg-neutral-100"}`}>{n}</span>
            </button>
          );
        })}
      </div>
      <ul className="grid grid-flow-dense grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        {shown.map((c, i) => (
          <Reveal key={`${group}-${c.slug}`} as="li" delay={(i % 4) * 70} variant="scale" className={c.wide ? "col-span-2" : ""}>
            <Link href={`/request-a-quote?mineral=${encodeURIComponent(c.name)}`} className="group relative block overflow-hidden rounded-3xl bg-neutral-900 shadow-xl shadow-neutral-900/15 ring-1 ring-black/5 transition duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-gold-500/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold-500/50">
              <img src={`/images/commodities/${c.slug}.jpg`} alt={c.name} width={1000} height={c.wide ? 667 : 1000} loading="lazy" decoding="async" className={`w-full object-cover transition-transform duration-700 group-hover:scale-105 ${c.wide ? "aspect-[2/1] object-top" : "aspect-square"}`} />
              <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/75 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4 text-white md:p-5">
                <span className="text-[15px] font-bold leading-tight md:text-lg">{c.name}<span className="sr-only">: request a quote</span></span>
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-500 text-ink shadow-lg transition group-hover:bg-gold-300"><FaArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
              </span>
            </Link>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}
