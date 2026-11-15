import { FaArrowRight } from "react-icons/fa";
import Link from "next/link";
import { Reveal } from "@/components/web/motion";
import { CheckList } from "@/components/web/sections";
import { ButtonLink, CtaBand, PageHero, SectionHeading, badge, bodyFont, card, container, headingFont } from "@/components/web/ui";
import { INDUSTRIES, mineralBySlug } from "@/content/site";
import { INDUSTRY_MATERIALS, commodityBySlug } from "@/content/photos";
import { pageMeta } from "@/content/seo";

export const metadata = pageMeta("Industries", "Steel and metallurgy, glass and ceramics, construction, power and energy, and industrial manufacturing: the industries we supply with minerals.", "/industries");

export default function IndustriesPage() {
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Who we serve" title="Industries we serve" description="Different industries need different minerals, specifications and delivery rhythms. We supply each of them with the same discipline." crumbs={[{ label: "Industries" }]} />

      <section aria-label="Industries overview" className="bg-white">
        <div className={`${container} py-9 md:py-12`}>
          <SectionHeading title="Five industries, one reliable supplier" center />
          <ul className="flex flex-wrap justify-center gap-3">
            {INDUSTRIES.map((i) => (
              <li key={i.slug}><a href={`#${i.slug}`} className="group inline-flex items-center gap-2.5 rounded-full border border-neutral-200 bg-white px-5 py-3 text-base font-bold text-neutral-800 transition hover:border-gold-200 hover:text-gold-700 hover:shadow-lg"><i.icon className="size-5 text-gold-700" aria-hidden />{i.name}</a></li>
            ))}
          </ul>
        </div>
      </section>

      {INDUSTRIES.map((ind, idx) => (
        <section key={ind.slug} id={ind.slug} aria-labelledby={`${ind.slug}-title`} className={`scroll-mt-[calc(var(--site-header-h)+8px)] ${idx % 2 === 0 ? "bg-neutral-50" : "bg-white"}`}>
          <div className={`${container} grid items-start gap-10 py-9 md:grid-cols-[0.9fr_1.1fr] md:gap-16 md:py-12`}>
            <Reveal variant={idx % 2 ? "right" : "left"} className={idx % 2 ? "md:order-2" : ""}>
              <div aria-hidden className={`${badge} mb-6 size-20`}><ind.icon className="size-10" /></div>
              <h2 id={`${ind.slug}-title`} className={`${headingFont} mb-4 text-[28px] leading-tight text-neutral-900 md:text-[38px]`}>{ind.name}</h2>
              <p className="text-lg leading-8 text-neutral-600">{ind.summary}</p>
              <div className="mt-7"><ButtonLink href={`/request-a-quote?mineral=${encodeURIComponent(ind.name)}`} variant="outline">Request a quote</ButtonLink></div>
            </Reveal>
            <Reveal variant={idx % 2 ? "left" : "right"} delay={120} className={idx % 2 ? "md:order-1" : ""}>
              <div className={`${card} p-7 md:p-9`}>
                <h3 className="mb-4 text-xl font-bold text-neutral-900">What this industry needs</h3>
                <CheckList items={ind.needs} />
                <h3 className="mb-4 mt-8 text-xl font-bold text-neutral-900">Minerals we supply for it</h3>
                <ul className="flex flex-wrap gap-2.5">
                  {ind.minerals.map((s) => {
                    const m = mineralBySlug(s);
                    return m && (
                      <li key={s}><Link href={`/minerals/${s}`} className="group inline-flex items-center gap-2 rounded-full bg-gold-50 px-4 py-2 text-sm font-bold text-gold-700 transition hover:bg-gold-500 hover:text-ink"><m.icon className="size-4" aria-hidden />{m.name}<FaArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden /></Link></li>
                    );
                  })}
                </ul>
              </div>
            </Reveal>
            {(INDUSTRY_MATERIALS[ind.slug] ?? []).length > 0 && (
              <div className="md:col-span-2">
                <h3 className="mb-5 text-xl font-bold text-neutral-900 md:text-2xl">Materials for {ind.name}</h3>
                <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
                  {(INDUSTRY_MATERIALS[ind.slug] ?? []).map((slug, i) => {
                    const c = commodityBySlug(slug);
                    return c && (
                      <Reveal key={slug} as="li" variant="scale" delay={i * 90}>
                        <Link href={`/request-a-quote?mineral=${encodeURIComponent(c.name)}`} className="group relative block overflow-hidden rounded-3xl bg-neutral-900 shadow-xl shadow-neutral-900/15 ring-1 ring-black/5 transition duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-gold-500/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold-500/50">
                          <img src={`/images/commodities/${c.slug}.jpg`} alt={c.name} width={1000} height={1000} loading="lazy" decoding="async" className="aspect-square w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/75 to-transparent" />
                          <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4 text-white">
                            <span className="text-[15px] font-bold leading-tight md:text-base">{c.name}<span className="sr-only">: request a quote</span></span>
                            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold-500 text-ink shadow-lg transition group-hover:bg-gold-300"><FaArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" /></span>
                          </span>
                        </Link>
                      </Reveal>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </section>
      ))}

      <CtaBand />
    </div>
  );
}
