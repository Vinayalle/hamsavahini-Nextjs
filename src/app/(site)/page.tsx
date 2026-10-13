import type { Metadata } from "next";
import { LuBadgeCheck, LuEarth, LuLeaf, LuMapPin, LuNewspaper } from "react-icons/lu";
import Hero from "@/components/web/Hero";
import { Reveal } from "@/components/web/motion";
import { CheckList, IndustryCard, PostGridCard, SeeAll, SplitFeature } from "@/components/web/sections";
import { ButtonLink, CtaBand, PointCard, SectionHeading, Tag, badge, bodyFont, card, container, headingFont } from "@/components/web/ui";
import { CAPABILITIES, COMPANY, INDUSTRIES, WHY_US, mineralBySlug } from "@/content/site";
import { getHeroSlides, type HeroSlide } from "@/server/services/site";
import { listLocations, listPosts, loadPublic } from "@/server/services/public";


export const metadata: Metadata = {
  title: { absolute: `${COMPANY.name} | Global mineral sourcing and trading` },
  description: COMPANY.description,
  alternates: { canonical: "/" },
};

const SPOTLIGHT = ["iron-ore-fines", "granite-dimension-stones", "quartz-silica-minerals"].map((s) => mineralBySlug(s)!);

export default async function HomePage() {
  const [slidesResult, postsResult, locationsResult] = await Promise.all([
    loadPublic<HeroSlide[]>(() => getHeroSlides(), []),
    loadPublic(() => listPosts({ take: 3 }), { items: [], total: 0 }),
    loadPublic(() => listLocations(), []),
  ]);
  const posts = postsResult.data.items;
  const locations = locationsResult.data.slice(0, 6);

  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <Hero slides={slidesResult.data} />

      {/* Introduction */}
      <section aria-labelledby="intro-title" className="bg-white">
        <div className={`${container} grid items-center gap-12 py-10 md:grid-cols-[1.15fr_0.85fr] md:gap-16 md:py-14`}>
          <Reveal variant="left">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-gold-700">About {COMPANY.short}</p>
            <h2 id="intro-title" className={`${headingFont} mb-6 text-[30px] leading-tight text-neutral-900 md:text-[46px]`}>Connecting trusted producers with industries that need them</h2>
            <div className="space-y-4 text-base leading-7 text-neutral-600 md:text-lg md:leading-8">
              <p>{COMPANY.description} Based in India, we specialize in high-grade mineral and ore supply, providing seamless trade and logistics solutions to clients worldwide.</p>
              <p>We combine verified sourcing, tested quality and managed logistics, so the material you order arrives as agreed.</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/about">Read more about us</ButtonLink>
              <ButtonLink href="/request-a-quote" variant="outline" arrow={false}>Request a quote</ButtonLink>
            </div>
          </Reveal>
          <Reveal variant="right" delay={120}>
            <div className={`${card} relative overflow-hidden bg-gradient-to-br from-neutral-950 to-neutral-800 p-7 text-white shadow-2xl shadow-neutral-900/20 md:p-9`}>
              <div aria-hidden className="about-float absolute -right-10 -top-10 size-44 rounded-full bg-gold-500/40 blur-3xl" />
              <h3 className={`${headingFont} relative mb-5 text-2xl`}>Why partner with us</h3>
              <ul className="relative space-y-4">
                {WHY_US.map((w) => (
                  <li key={w.title} className="flex items-start gap-3.5">
                    <span aria-hidden className={`${badge} mt-0.5 size-10 !rounded-xl`}><w.icon className="size-5" /></span>
                    <span className="pt-1.5 text-[15px] font-bold leading-snug">{w.title}</span>
                  </li>
                ))}
              </ul>
              <a href="/about#why" className="relative mt-6 inline-block text-sm font-bold text-gold-300 underline-offset-4 hover:underline">See what sets us apart</a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* What we do */}
      <section aria-labelledby="do-title" className="bg-neutral-50">
        <div className={`${container} py-10 md:py-14`}>
          <SectionHeading id="do-title" eyebrow="What we do" title="From the mine to your port" description="Five connected services that take a consignment from verified source to the destination you name." />
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c, i) => <PointCard key={c.title} icon={c.icon} title={c.title} text={c.text} index={i} />)}
          </ul>
        </div>
      </section>

      {/* Mineral spotlights */}
      <section aria-labelledby="minerals-title" className="bg-white">
        <div className={`${container} py-10 md:py-14`}>
          <SectionHeading id="minerals-title" eyebrow="What we supply" title="Minerals for the industries that build the world" center />
          <div className="space-y-12 md:space-y-28">
            {SPOTLIGHT.map((m, i) => (
              <SplitFeature key={m.slug} eyebrow={m.name} title={m.short} icon={m.icon} flip={i % 2 === 1} action={<ButtonLink href={`/minerals/${m.slug}`}>Explore {m.name}</ButtonLink>}>
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
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(55%_80%_at_85%_0%,rgba(185,134,38,0.3),transparent_62%)]" />
        <div className={`${container} space-y-12 py-10 md:space-y-28 md:py-14`}>
          <SplitFeature dark eyebrow="Quality" title="Tested, certified and traceable" icon={LuBadgeCheck} action={<ButtonLink href="/quality-compliance" variant="white">How we assure quality</ButtonLink>}>
            <p>Each shipment is tested and certified to international standards, with full traceability and transparent documentation, so you know what you are buying before it sails.</p>
          </SplitFeature>
          <SplitFeature dark flip eyebrow="Responsibility" title="Sourcing that respects people and places" icon={LuLeaf} action={<ButtonLink href="/sustainability" variant="white">Our sustainability commitment</ButtonLink>}>
            <p>Sustainability is integral to our operations. We promote responsible mining practices, fair trade and environmental stewardship in every partnership.</p>
          </SplitFeature>
        </div>
      </section>

      {/* Global reach */}
      <section aria-labelledby="reach-title" className="bg-white">
        <div className={`${container} py-10 md:py-14`}>
          <SplitFeature eyebrow="Global reach" title="Global reach with local expertise" icon={LuEarth} action={<ButtonLink href="/global-operations">Explore our operations</ButtonLink>}>
            <p>We connect resource-rich regions with industries around the world, handling warehousing, shipping and customs so every consignment reaches its destination smoothly and on time.</p>
          </SplitFeature>
          {locations.length > 0 && (
            <ul aria-label="Locations" className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {locations.map((l, i) => (
                <Reveal key={l.id} as="li" delay={(i % 3) * 90}>
                  <div className={`${card} flex items-start gap-4 p-5`}>
                    <span aria-hidden className={`${badge} size-11 !rounded-xl`}><LuMapPin className="size-5" /></span>
                    <div className="min-w-0">
                      <p className="font-bold text-neutral-900">{l.name}</p>
                      <p className="text-sm text-neutral-600">{[l.city, l.country].filter(Boolean).join(", ")}</p>
                      <div className="mt-2"><Tag>{l.type}</Tag></div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>
          )}
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

      {/* Latest insights */}
      {posts.length > 0 && (
        <section aria-labelledby="insights-title" className="bg-white">
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
