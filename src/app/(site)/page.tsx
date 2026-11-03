import type { Metadata } from "next";
import { LuBadgeCheck, LuEarth, LuLeaf, LuMapPin, LuNewspaper, LuPackage } from "react-icons/lu";
import Hero from "@/components/web/Hero";
import { CountUp, Reveal } from "@/components/web/motion";
import { CheckList, IndustryCard, Marquee, PostGridCard, ProductGridCard, SeeAll, SplitFeature } from "@/components/web/sections";
import { ButtonLink, CtaBand, PointCard, SectionHeading, Tag, badge, bodyFont, card, container, headingFont } from "@/components/web/ui";
import { MINERAL_PHOTO, PHOTOS } from "@/content/photos";
import { CAPABILITIES, COMPANY, INDUSTRIES, MINERALS, WHY_US, mineralBySlug } from "@/content/site";
import { listLocations, listPosts, listProducts, listRecentProducts, loadPublic } from "@/server/services/public";


export const metadata: Metadata = {
  title: { absolute: `${COMPANY.name} | Global mineral sourcing and trading` },
  description: COMPANY.description,
  alternates: { canonical: "/" },
};

const SPOTLIGHT = ["iron-ore-fines", "granite-dimension-stones", "quartz-silica-minerals"].map((s) => mineralBySlug(s)!);

export default async function HomePage() {
  const [postsResult, locationsResult, productsResult, totalResult] = await Promise.all([
    loadPublic(() => listPosts({ take: 3 }), { items: [], total: 0 }),
    loadPublic(() => listLocations(), []),
    loadPublic(() => listRecentProducts(6), []),
    loadPublic(() => listProducts({ take: 1 }), { items: [], total: 0 }),
  ]);
  const recentProducts = productsResult.data;
  // Only real numbers: what the website itself lists. A number that is zero is not shown.
  const numbers = [
    { value: MINERALS.length, label: "Minerals we supply" },
    { value: INDUSTRIES.length, label: "Industries we serve" },
    { value: totalResult.data.total, label: "Products in the catalogue" },
    { value: locationsResult.data.length, label: "Locations worldwide" },
  ].filter((n) => n.value > 0);
  const posts = postsResult.data.items;
  const locations = locationsResult.data.slice(0, 6);

  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <Hero />

      {/* Minerals ticker */}
      <section aria-label="Minerals we supply" className="relative overflow-hidden border-y border-gold-500/20 bg-neutral-950 py-4">
        <div aria-hidden className="soft-pulse absolute left-1/2 top-1/2 h-24 w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-500/15 blur-3xl" />
        <Marquee items={MINERALS.map((m) => m.name)} label="Minerals we supply" />
      </section>

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
                {WHY_US.map((w, i) => (
                  <Reveal key={w.title} as="li" variant="left" delay={200 + i * 110} className="flex items-start gap-3.5">
                    <span aria-hidden className={`${badge} mt-0.5 size-10 !rounded-xl`}><w.icon className="size-5" /></span>
                    <span className="pt-1.5 text-[15px] font-bold leading-snug">{w.title}</span>
                  </Reveal>
                ))}
              </ul>
              <a href="/about#why" className="relative mt-6 inline-block text-sm font-bold text-gold-300 underline-offset-4 hover:underline">See what sets us apart</a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* By the numbers: counts up when it scrolls into view */}
      {numbers.length > 0 && (
        <section aria-label="Our numbers" className="relative isolate overflow-hidden bg-gradient-to-br from-gold-800 via-gold-700 to-gold-600 text-white">
          <div aria-hidden className="about-grid absolute inset-0 -z-10 opacity-[0.1]" />
          <div aria-hidden className="about-float absolute -left-16 top-0 -z-10 size-72 rounded-full bg-gold-300/25 blur-3xl" />
          <div aria-hidden className="about-float-slow absolute -right-10 bottom-0 -z-10 size-72 rounded-full bg-gold-900/40 blur-3xl" />
          <dl className={`${container} grid grid-cols-2 gap-y-8 py-10 md:py-12 ${({ 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" } as Record<number, string>)[Math.min(numbers.length, 4)]}`}>
            {numbers.map((n, i) => (
              <Reveal key={n.label} variant="scale" delay={i * 120} className="text-center">
                <dd className={`${headingFont} text-[44px] leading-none text-gold-200 md:text-[64px]`}><CountUp to={n.value} /></dd>
                <dt className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-white/80 md:text-sm">{n.label}</dt>
              </Reveal>
            ))}
          </dl>
        </section>
      )}

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
          <SplitFeature dark flip eyebrow="Responsibility" title="Sourcing that respects people and places" icon={LuLeaf} photo={PHOTOS.sustainability} action={<ButtonLink href="/sustainability" variant="white">Our sustainability commitment</ButtonLink>}>
            <p>Sustainability is integral to our operations. We promote responsible mining practices, fair trade and environmental stewardship in every partnership.</p>
          </SplitFeature>
        </div>
      </section>

      {/* Global reach */}
      <section aria-labelledby="reach-title" className="bg-white">
        <div className={`${container} py-10 md:py-14`}>
          <SplitFeature eyebrow="Global reach" title="Global reach with local expertise" icon={LuEarth} photo={PHOTOS.global} action={<ButtonLink href="/global-operations">Explore our operations</ButtonLink>}>
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
