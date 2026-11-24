import type { Metadata } from "next";
import Link from "next/link";
import { LuBadgeCheck, LuEarth, LuMapPin, LuNewspaper, LuPackage } from "react-icons/lu";
import { IconGlobe, IconMountain, IconShield, IconShip } from "@/components/web/brand-icons";
import Hero from "@/components/web/Hero";
import { CountUp, Reveal } from "@/components/web/motion";
import { CheckList, IndustryCard, PostGridCard, ProcessFlow, ProductGridCard, SeeAll, SplitFeature } from "@/components/web/sections";
import { ButtonLink, CtaBand, SectionHeading, Tag, badge, bodyFont, card, container, headingFont } from "@/components/web/ui";
import { MineralStrip } from "@/components/web/MineralStrip";
import { MINERAL_PHOTO, PHOTOS } from "@/content/photos";
import { SOURCING_PLACES } from "@/content/sourcing";
import { CAPABILITIES, COMPANY, INDUSTRIES, MINERALS, mineralBySlug } from "@/content/site";
import { listPosts, listRecentProducts, loadPublic } from "@/server/services/public";


export const metadata: Metadata = {
  title: { absolute: `${COMPANY.name} | Global mineral sourcing and trading` },
  description: COMPANY.description,
  alternates: { canonical: "/" },
};

const SPOTLIGHT = ["iron-ore-fines", "granite-dimension-stones", "quartz-silica-minerals"].map((s) => mineralBySlug(s)!);
const SUPPLY_GROUPS = ["Ferrous & Ferroalloys", "Base Metals", "Industrial Minerals", "Energy & Fuels", "Dimension Stones", "Agri"];

export default async function HomePage() {
  const [postsResult, productsResult] = await Promise.all([
    loadPublic(() => listPosts({ take: 3 }), { items: [], total: 0 }),
    loadPublic(() => listRecentProducts(6), []),
  ]);
  const recentProducts = productsResult.data;
  // The numbers band. The two sourcing figures are counted from the sourcing list (src/content/sourcing.ts); the years are fixed text.
  const sourcing = SOURCING_PLACES.filter((p) => p.kind === "sourcing");
  const numbers = [
    { value: 30, suffix: "+", label: "Years of board experience", icon: IconShield },
    { value: new Set(sourcing.map((p) => p.country)).size, suffix: "", label: "Sourcing countries", icon: IconGlobe },
    { value: sourcing.length, suffix: "", label: "Sourcing regions", icon: IconMountain },
  ].filter((n) => n.value > 0);
  const posts = postsResult.data.items;
  const sourcingRegions = SOURCING_PLACES.filter((p) => p.kind === "sourcing").slice(0, 6);

  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <Hero />

      {/* Minerals strip */}
      <MineralStrip items={MINERALS.map((m) => ({ name: m.name, href: `/minerals/${m.slug}`, image: `/images/strip/${m.slug}.png` }))} />

      {/* About: who we are, why partner with us, and a picture of the work */}
      <section aria-labelledby="intro-title" className="relative overflow-hidden bg-white">
        <div aria-hidden className="absolute -left-24 top-10 size-80 rounded-full bg-gold-200/40 blur-3xl" />
        <div className={`${container} relative grid items-stretch gap-10 py-12 md:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14`}>
          <Reveal variant="left" className="flex flex-col justify-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-gold-700">About {COMPANY.short}</p>
            <h2 id="intro-title" className={`${headingFont} mb-5 text-[30px] leading-[1.15] text-neutral-900 md:text-[44px]`}>
              Connecting Trusted Producers with <span className="text-gold-600">Industries That Need Them</span>
            </h2>
            <p className="text-base leading-7 text-neutral-600 md:text-lg md:leading-8">A Hyderabad-based sourcing and trading company supplying steel, cement, glass and power industries across domestic and international markets.</p>
            <ul className="mt-8 grid grid-cols-3 divide-x divide-gold-600/25">
              {[{ icon: IconMountain, a: "Sourcing &", b: "Development" }, { icon: IconShield, a: "Quality &", b: "Compliance" }, { icon: IconShip, a: "Global", b: "Supply Chain" }].map((p) => (
                <li key={p.a} className="flex flex-col items-start gap-3 px-3 first:pl-0 sm:flex-row sm:items-center sm:px-5">
                  <p.icon strokeWidth={2.8} className="size-11 shrink-0 text-gold-600 md:size-12" />
                  <span className="text-[13px] font-bold leading-snug text-neutral-900 md:text-sm">{p.a}<br />{p.b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-9 flex flex-wrap gap-3"><ButtonLink href="/about">Explore Our Company</ButtonLink><ButtonLink href="/partner-with-us" variant="outline">Partner With Us</ButtonLink></div>
          </Reveal>

          <Reveal variant="right" delay={160} className="relative min-h-[380px] sm:min-h-[460px] lg:min-h-[520px]">
            <figure className="group absolute right-0 top-0 h-[84%] w-[80%] overflow-hidden rounded-3xl shadow-2xl shadow-neutral-900/25 ring-1 ring-black/10">
              <img src="/images/about-mine.jpg" alt="A mining truck on a haul road in an open-pit mine" width={1100} height={620} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-1000 group-hover:scale-105" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            </figure>
            <figure className="group about-bob absolute bottom-0 left-0 h-[48%] w-[56%] overflow-hidden rounded-3xl shadow-2xl shadow-neutral-900/30 ring-8 ring-[var(--band)]">
              <img src="/images/about-port.jpg" alt="A container ship at sea carrying mineral cargo" width={900} height={506} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-1000 group-hover:scale-105" />
            </figure>
            <span aria-hidden className="absolute right-6 bottom-8 hidden size-24 rounded-full border-2 border-dashed border-gold-500/60 sm:block about-spin-slow" />
          </Reveal>
        </div>
      </section>

      {/* By the numbers: counts up when it scrolls into view */}
      {numbers.length > 0 && (
        <section aria-label="Our numbers" className="relative isolate overflow-hidden bg-[#24150a] text-white">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(50%_120%_at_50%_0%,rgba(176,128,64,0.28),transparent_70%)]" />
          {[false, true].map((flip) => (
            <svg key={String(flip)} aria-hidden viewBox="0 0 300 110" className={`pointer-events-none absolute bottom-0 -z-10 h-24 w-[22%] min-w-[150px] opacity-80 ${flip ? "right-0 -scale-x-100" : "left-0"}`} fill="none" stroke="#d8b574" strokeLinecap="round">
              {[0, 7, 14, 21, 28, 35].map((d) => (
                <path key={d} d={`M0 ${96 - d} C 70 ${20 + d}, 160 ${112 - d}, 300 ${58 - d / 2}`} strokeWidth="1.1" strokeDasharray="0.1 4" opacity={0.95 - d / 60} />
              ))}
              <path d="M0 100 C 80 40, 170 112, 300 64" strokeWidth="1.6" opacity="0.7" />
            </svg>
          ))}
          <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-gold-400/50 to-transparent" />
          <dl className={`${container} grid grid-cols-2 gap-y-8 py-9 md:py-11 ${({ 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" } as Record<number, string>)[Math.min(numbers.length, 4)]}`}>
            {numbers.map((n, i) => (
              <Reveal key={n.label} variant="scale" delay={i * 120} className="flex flex-col items-center border-gold-500/25 lg:border-l lg:first:border-l-0">
                <div className="flex items-center gap-3 md:gap-4">
                  <n.icon strokeWidth={2.6} className="size-10 text-gold-400 md:size-12" />
                  <span className="text-[34px] font-bold leading-none tracking-tight text-white md:text-[46px]"><CountUp to={n.value} suffix={n.suffix} /></span>
                </div>
                <dt className="mt-3 text-center text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/90 md:text-[13px]">{n.label}</dt>
              </Reveal>
            ))}
          </dl>
          <div aria-hidden className="h-[3px] w-full bg-gradient-to-r from-transparent via-gold-400 to-transparent shadow-[0_0_22px_6px_rgba(216,181,116,0.45)]" />
        </section>
      )}

      {/* What we do */}
      <section aria-labelledby="do-title" className="bg-neutral-50">
        <div className={`${container} py-10 md:py-14`}>
          <SectionHeading id="do-title" title="How we work" description="Four connected services that take a consignment from verified source to the destination you name." />
          <div className="mt-12 md:mt-14"><ProcessFlow steps={CAPABILITIES} numbered={false} /></div>
        </div>
      </section>

      {/* What we supply */}
      <section aria-labelledby="minerals-title" className="bg-white">
        <div className={`${container} py-12 md:py-16`}>
          <SectionHeading id="minerals-title" eyebrow="What we supply" title="What we supply" description="We supply high-grade ores and industrial minerals from verified mines in India and select international origins, to the grade and size each buyer specifies." center />
          <ul aria-label="What we supply" className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3">
            {SUPPLY_GROUPS.map((g, i) => (
              <Reveal key={g} as="li" variant="scale" delay={i * 80}>
                <Link href="/minerals" className="inline-flex items-center rounded-full border border-gold-600/30 bg-white/70 px-5 py-3 text-base font-bold text-neutral-800 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-gold-500 hover:bg-gold-500 hover:text-ink hover:shadow-lg">{g}</Link>
              </Reveal>
            ))}
          </ul>

          {/* Mineral spotlights */}
          <div className="mt-14 space-y-12 md:mt-20 md:space-y-28">
            {SPOTLIGHT.map((m, i) => (
              <SplitFeature key={m.slug} eyebrow={m.name} title={m.short} icon={m.icon} photo={MINERAL_PHOTO[m.slug]} flip={i % 2 === 1} action={<ButtonLink href={`/minerals/${m.slug}`}>Explore {m.name}</ButtonLink>}>
                <p>{m.intro}</p>
                <CheckList items={m.uses.slice(0, 3)} />
              </SplitFeature>
            ))}
          </div>
          <SeeAll href="/minerals">See all minerals</SeeAll>
        </div>
      </section>

      {/* Quality and responsible mining */}
      <section aria-label="Quality and responsibility" className="relative isolate overflow-hidden bg-neutral-950 text-white">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(55%_80%_at_85%_0%,rgba(176,128,64,0.3),transparent_62%)]" />
        <div aria-hidden className="about-float absolute -left-24 top-1/3 -z-10 size-80 rounded-full bg-gold-500/20 blur-3xl" />
        <div aria-hidden className="about-float-slow absolute -right-20 bottom-10 -z-10 size-72 rounded-full bg-gold-300/15 blur-3xl" />
        <div className={`${container} space-y-12 py-10 md:space-y-28 md:py-14`}>
          <SplitFeature dark eyebrow="Quality" title="Tested, certified and traceable" icon={LuBadgeCheck} photo={PHOTOS.quality} action={<ButtonLink href="/quality-compliance" variant="white">How we assure quality</ButtonLink>}>
            <p>Each shipment is tested and certified to international standards, with full traceability and transparent documentation, so you know what you are buying before it sails.</p>
          </SplitFeature>
        </div>
      </section>

      {/* Global reach */}
      <section aria-labelledby="reach-title" className="bg-white">
        <div className={`${container} py-10 md:py-14`}>
          <SplitFeature eyebrow="Global reach" title="Global reach with local expertise" icon={LuEarth} photo={PHOTOS.global} action={<ButtonLink href="/global-operations">Explore our operations</ButtonLink>}>
            <p>We connect resource-rich regions with industries around the world, handling warehousing, shipping and customs so every consignment reaches its destination smoothly and on time.</p>
          </SplitFeature>
          <ul aria-label="Where we source" className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sourcingRegions.map((l, i) => (
              <Reveal key={l.name} as="li" delay={(i % 3) * 90}>
                <div className={`${card} flex h-full items-start gap-4 p-5`}>
                  <span aria-hidden className={`${badge} size-11 !rounded-xl`}><LuMapPin className="size-5" /></span>
                  <div className="min-w-0">
                    <p className="font-bold text-neutral-900">{l.name}</p>
                    <p className="text-sm text-neutral-600">{l.country}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">{l.commodities.slice(0, 3).map((c) => <Tag key={c}>{c}</Tag>)}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Industries */}
      <section aria-labelledby="industries-title" className="bg-neutral-50">
        <div className={`${container} py-10 md:py-14`}>
          <SectionHeading id="industries-title" eyebrow="Who we serve" title="Industries we serve" center />
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {INDUSTRIES.map((ind, i) => <IndustryCard key={ind.slug} industry={ind} index={i} href={`/industries#${ind.slug}`} />)}
          </ul>
        </div>
      </section>

      {/* Recent products: the newest published products from the admin */}
      {recentProducts.length > 0 && (
        <section aria-labelledby="recent-products-title" className="bg-white">
          <div className={`${container} py-10 md:py-14`}>
            <SectionHeading id="recent-products-title" eyebrow="Products" title="Recently added products" description="The newest minerals and materials in our catalogue, ready for enquiry." />
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {recentProducts.map((p, i) => <ProductGridCard key={p.slug} product={p} icon={LuPackage} index={i} />)}
            </ul>
            <SeeAll href="/products">All products</SeeAll>
          </div>
        </section>
      )}

      {/* Latest insights */}
      {posts.length > 0 && (
        <section aria-labelledby="insights-title" className="bg-neutral-50">
          <div className={`${container} py-10 md:py-14`}>
            <SectionHeading id="insights-title" eyebrow="Insights" title="Latest from our desk" />
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((p, i) => <PostGridCard key={p.slug} post={p} icon={LuNewspaper} index={i} />)}
            </ul>
            <SeeAll href="/insights">All insights</SeeAll>
          </div>
        </section>
      )}

      <CtaBand />
    </div>
  );
}
