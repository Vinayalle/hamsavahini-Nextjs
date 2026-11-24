import { FaArrowRight } from "react-icons/fa";
import Link from "next/link";
import { LuBadgeCheck, LuCircleCheck } from "react-icons/lu";
import { Reveal, Tilt } from "@/components/web/motion";
import { IndustryNav } from "@/components/web/IndustryNav";
import { ButtonLink, CtaBand, PageHero, badge, bodyFont, container, headingFont } from "@/components/web/ui";
import { INDUSTRIES, mineralBySlug } from "@/content/site";
import { INDUSTRY_MATERIALS, commodityBySlug } from "@/content/photos";
import { pageMeta } from "@/content/seo";

export const metadata = pageMeta("Industries", "Steel and metallurgy, glass and ceramics, construction, power and energy, and industrial manufacturing: the industries we supply with minerals.", "/industries");

/** The pictures that float beside the page title. */
const HERO_TILES = [
  { src: "/images/commodities/iron-ore.jpg", alt: "Iron ore", pos: "left-0 top-10 w-[54%] -rotate-6", delay: "0s" },
  { src: "/images/commodities/silica-sand.jpg", alt: "Silica sand", pos: "right-0 top-0 w-[50%] rotate-6", delay: "-0.8s" },
  { src: "/images/commodities/thermal-coal.jpg", alt: "Thermal coal", pos: "bottom-0 left-[24%] w-[52%] -rotate-2", delay: "-1.6s" },
];

export default function IndustriesPage() {
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero
        eyebrow="Who we serve"
        title="Industries we serve"
        description="Different industries need different minerals, specifications and delivery rhythms. We supply each of them with the same discipline."
        crumbs={[{ label: "Industries" }]}
        visual={(
          <div className="relative mx-auto h-[330px] w-full max-w-[440px] sm:h-[380px]">
            <div aria-hidden className="about-float absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-500/30 blur-3xl" />
            {HERO_TILES.map((t) => (
              <figure key={t.src} className={`about-bob absolute aspect-square overflow-hidden rounded-3xl bg-neutral-900 shadow-2xl shadow-black/50 ring-1 ring-white/25 ${t.pos}`} style={{ animationDelay: t.delay }}>
                <img src={t.src} alt={t.alt} width={1000} height={1000} decoding="async" className="size-full object-cover" />
              </figure>
            ))}
            {INDUSTRIES.slice(0, 4).map((ind, i) => (
              <span key={ind.slug} aria-hidden className={`${badge} about-float absolute size-12 !rounded-xl ${["left-[44%] top-[34%]", "right-[4%] top-[48%]", "left-[2%] bottom-[18%]", "right-[22%] bottom-[2%]"][i]}`} style={{ animationDelay: `${-i * 1.7}s` }}><ind.icon className="size-6" strokeWidth={2.2} /></span>
            ))}
          </div>
        )}
      >
      </PageHero>

      <IndustryNav />

      {INDUSTRIES.map((ind, idx) => {
        const dark = idx % 2 === 1;
        const materials = (INDUSTRY_MATERIALS[ind.slug] ?? []).map((s) => commodityBySlug(s)).filter((c) => !!c);
        const flip = idx % 2 === 1;
        return (
          <section key={ind.slug} id={ind.slug} aria-labelledby={`${ind.slug}-title`}
            className={`relative isolate overflow-hidden scroll-mt-[calc(var(--site-header-h)+64px)] ${dark ? "bg-neutral-950 text-white" : idx === 0 ? "bg-white" : "bg-neutral-50"}`}>
            {dark && (
              <>
                <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(55%_70%_at_85%_0%,rgba(176,128,64,0.3),transparent_62%),radial-gradient(45%_60%_at_0%_100%,rgba(176,128,64,0.16),transparent_62%)]" />
                <div aria-hidden className="about-grid absolute inset-0 -z-10 opacity-[0.07]" />
              </>
            )}

            <div className={`${container} grid items-start gap-10 py-12 md:grid-cols-[0.9fr_1.1fr] md:gap-16 md:py-16`}>
              <Reveal variant={flip ? "right" : "left"} className={flip ? "md:order-2" : ""}>
                <div className="relative mb-7 inline-flex">
                  <span aria-hidden className="about-ring absolute inset-0 rounded-3xl bg-gold-500/30" />
                  <div aria-hidden className={`${badge} about-bob relative size-20 !rounded-3xl md:size-24`}><ind.icon className="size-10 md:size-12" strokeWidth={2} /></div>
                </div>
                <h2 id={`${ind.slug}-title`} className={`${headingFont} mb-4 text-[30px] leading-tight md:text-[42px] ${dark ? "text-white" : "text-neutral-900"}`}>{ind.name}</h2>
                <p className={`text-lg leading-8 ${dark ? "text-white/75" : "text-neutral-600"}`}>{ind.summary}</p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <ButtonLink href={`/request-a-quote?mineral=${encodeURIComponent(ind.name)}`} variant={dark ? "primary" : "outline"}>Request a quote</ButtonLink>
                  <span className={`rounded-full border px-4 py-2 text-sm font-bold ${dark ? "border-white/20 text-white/80" : "border-gold-600/30 text-gold-700"}`}>{ind.minerals.length} {ind.minerals.length === 1 ? "mineral" : "minerals"} · {materials.length} {materials.length === 1 ? "material" : "materials"}</span>
                </div>
              </Reveal>

              <Reveal variant={flip ? "left" : "right"} delay={120} className={flip ? "md:order-1" : ""}>
                <div className={`group relative overflow-hidden rounded-3xl p-7 md:p-9 ${dark ? "border border-white/10 bg-white/[0.05] shadow-2xl shadow-black/40 backdrop-blur" : "border border-neutral-200 bg-white shadow-xl shadow-neutral-900/5"}`}>
                  <span aria-hidden className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-gold-400 to-gold-200 transition-transform duration-700 group-hover:scale-x-100" />
                  <h3 className={`mb-5 text-xl font-bold ${dark ? "text-white" : "text-neutral-900"}`}>What this industry needs</h3>
                  <ul className="space-y-3.5">
                    {ind.needs.map((n, i) => (
                      <Reveal key={n} as="li" variant="left" delay={160 + i * 110} className={`flex items-start gap-3 text-[17px] leading-7 ${dark ? "text-white/85" : "text-neutral-700"}`}>
                        <LuCircleCheck className={`mt-1 size-5 shrink-0 ${dark ? "text-gold-300" : "text-gold-600"}`} aria-hidden />{n}
                      </Reveal>
                    ))}
                  </ul>
                  <h3 className={`mb-4 mt-8 text-xl font-bold ${dark ? "text-white" : "text-neutral-900"}`}>Minerals we supply for it</h3>
                  <ul className="flex flex-wrap gap-2.5">
                    {ind.minerals.map((s) => {
                      const m = mineralBySlug(s);
                      return m && (
                        <li key={s}><Link href={`/minerals/${s}`} className={`group/chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition duration-300 hover:-translate-y-0.5 ${dark ? "bg-white/10 text-gold-200 hover:bg-gold-500 hover:text-ink" : "bg-gold-50 text-gold-700 hover:bg-gold-500 hover:text-ink"}`}><m.icon className="size-4" aria-hidden />{m.name}<FaArrowRight className="size-3 transition-transform group-hover/chip:translate-x-1" aria-hidden /></Link></li>
                      );
                    })}
                  </ul>
                </div>
              </Reveal>

              {materials.length > 0 && (
                <div className="md:col-span-2">
                  <h3 className={`mb-5 text-xl font-bold md:text-2xl ${dark ? "text-white" : "text-neutral-900"}`}>Materials for {ind.name}</h3>
                  <ul className={`grid grid-cols-2 gap-4 lg:gap-5 ${materials.length >= 4 ? "lg:grid-cols-4" : materials.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2 lg:max-w-[50%]"}`}>
                    {materials.map((c, i) => c && (
                      <Reveal key={c.slug} as="li" variant="scale" delay={i * 100}>
                        <Tilt className="rounded-3xl" max={5}>
                          <Link href={`/request-a-quote?mineral=${encodeURIComponent(c.name)}`} className="group/tile relative block overflow-hidden rounded-3xl bg-neutral-900 shadow-xl shadow-neutral-900/20 ring-1 ring-black/10 transition duration-300 hover:shadow-2xl hover:shadow-gold-500/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold-500/50">
                            <img src={`/images/commodities/${c.slug}.jpg`} alt={c.name} width={1000} height={1000} loading="lazy" decoding="async" className="aspect-square w-full object-cover transition-transform duration-700 group-hover/tile:scale-110" />
                            <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
                            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4 text-white">
                              <span className="text-[15px] font-bold leading-tight md:text-base">{c.name}<span className="sr-only">: request a quote</span></span>
                              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-500 text-ink shadow-lg transition duration-300 group-hover/tile:rotate-[-45deg] group-hover/tile:bg-gold-300"><FaArrowRight className="size-3" /></span>
                            </span>
                          </Link>
                        </Tilt>
                      </Reveal>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        );
      })}

      <section aria-label="Quality" className="relative isolate overflow-hidden bg-neutral-950 text-white">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_120%_at_50%_0%,rgba(176,128,64,0.45),transparent_65%)]" />
        <div aria-hidden className="about-grid absolute inset-0 -z-10 opacity-[0.07]" />
        <div aria-hidden className="about-float absolute -left-16 top-4 -z-10 size-64 rounded-full bg-gold-500/25 blur-3xl" />
        <div aria-hidden className="about-float-slow absolute -right-16 bottom-0 -z-10 size-64 rounded-full bg-gold-300/20 blur-3xl" />
        <div className={`${container} py-12 md:py-16`}>
          <Reveal variant="scale">
            <Link href="/quality-compliance" className="group mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-3xl border border-gold-400/40 bg-white/[0.06] px-6 py-9 text-center shadow-2xl shadow-black/40 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-gold-300 hover:bg-white/10 md:px-12 md:py-12">
              <span aria-hidden className={`${badge} about-bob size-16 !rounded-2xl`}><LuBadgeCheck className="size-8" strokeWidth={2} /></span>
              <p className={`${headingFont} text-[24px] leading-snug text-white md:text-[34px] md:leading-[1.25]`}>
                Every shipment is tested against your agreed specification and comes with a <span className="shimmer-text">certificate of analysis.</span>
              </p>
              <span className="btn-sheen inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-gold-400 to-gold-500 px-6 py-3 text-[15px] font-bold text-ink shadow-lg shadow-gold-500/30 transition group-hover:from-gold-300 group-hover:to-gold-400">Quality &amp; compliance <FaArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden /></span>
            </Link>
          </Reveal>
        </div>
      </section>

      <CtaBand />
    </div>
  );
}
