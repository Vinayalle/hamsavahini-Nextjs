import { FaArrowRight } from "react-icons/fa";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LuFlaskConical, LuPickaxe, LuShip } from "react-icons/lu";
import { Reveal } from "@/components/web/motion";
import { CheckList, MineralCard } from "@/components/web/sections";
import { ButtonLink, CtaBand, PageHero, PointCard, SectionHeading, Tag, badge, bodyFont, card, container, headingFont } from "@/components/web/ui";
import { MINERALS, industryBySlug, mineralBySlug } from "@/content/site";
import { pageMeta } from "@/content/seo";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const m = mineralBySlug((await params).slug);
  return m ? pageMeta(m.name, m.intro.slice(0, 158), `/minerals/${m.slug}`) : {};
}

export default async function MineralPage({ params }: Params) {
  const mineral = mineralBySlug((await params).slug);
  if (!mineral) notFound();
  const industries = mineral.industries.map((s) => industryBySlug(s)).filter((i) => !!i);
  const related = MINERALS.filter((m) => m.slug !== mineral.slug).slice(0, 3);
  const quote = `/request-a-quote?mineral=${encodeURIComponent(mineral.name)}`;

  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Minerals" title={mineral.name} description={mineral.short} crumbs={[{ label: "Minerals", href: "/minerals" }, { label: mineral.name }]}>
        <ButtonLink href={quote}>Request a quote for {mineral.name}</ButtonLink>
      </PageHero>

      <section aria-labelledby="overview" className="bg-white">
        <div className={`${container} grid gap-12 py-10 md:grid-cols-[1.2fr_0.8fr] md:gap-16 md:py-14`}>
          <Reveal variant="left">
            <h2 id="overview" className={`${headingFont} mb-5 text-[28px] leading-tight text-neutral-900 md:text-[40px]`}>About {mineral.name}</h2>
            <p className="text-lg leading-8 text-neutral-600 md:text-xl md:leading-9">{mineral.intro}</p>
            <h3 className="mb-4 mt-9 text-xl font-bold text-neutral-900">Common uses</h3>
            <CheckList items={mineral.uses} />
          </Reveal>
          <Reveal variant="right" delay={120}>
            <aside aria-label="Request a quote" className={`${card} relative overflow-hidden bg-gradient-to-br from-neutral-950 to-neutral-800 p-7 text-white shadow-2xl shadow-neutral-900/20 md:p-9`}>
              <div aria-hidden className="about-float absolute -right-10 -top-10 size-44 rounded-full bg-gold-500/40 blur-3xl" />
              <div aria-hidden className={`${badge} relative mb-5 size-14`}><mineral.icon className="size-7" /></div>
              <h3 className={`${headingFont} relative mb-3 text-2xl`}>Need {mineral.name}?</h3>
              <p className="relative mb-6 text-white/80">Tell us the grade, quantity and destination. We will come back with sourcing options and delivery terms.</p>
              <div className="relative flex flex-col gap-3">
                <ButtonLink href={quote} variant="white">Request a quote</ButtonLink>
                <ButtonLink href={`/contact-us?subject=${encodeURIComponent(`Enquiry about ${mineral.name}`)}`} variant="ghost" arrow={false}>Ask a question</ButtonLink>
              </div>
            </aside>
          </Reveal>
        </div>
      </section>

      {industries.length > 0 && (
        <section aria-labelledby="industries" className="bg-neutral-50">
          <div className={`${container} py-9 md:py-12`}>
            <SectionHeading id="industries" title={`Industries that use ${mineral.name}`} />
            <ul className="flex flex-wrap gap-3">
              {industries.map((i) => i && (
                <li key={i.slug}><Link href={`/industries#${i.slug}`} className="group inline-flex items-center gap-2.5 rounded-full border border-neutral-200 bg-white px-5 py-3 text-base font-bold text-neutral-800 transition hover:border-gold-200 hover:text-gold-700 hover:shadow-lg"><i.icon className="size-5 text-gold-700" aria-hidden />{i.name}<FaArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden /></Link></li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-labelledby="handling" className="bg-white">
        <div className={`${container} py-10 md:py-14`}>
          <SectionHeading id="handling" eyebrow="How we supply it" title="Sourced, tested and delivered" />
          <ul className="grid gap-5 md:grid-cols-3">
            {mineral.handling.map((h, i) => <PointCard key={h.title} icon={[LuPickaxe, LuFlaskConical, LuShip][i]} title={h.title} text={h.text} index={i} />)}
          </ul>
        </div>
      </section>

      <section aria-labelledby="notes" className="bg-neutral-50">
        <div className={`${container} grid gap-10 py-10 md:grid-cols-2 md:py-14`}>
          <Reveal variant="left">
            <h2 id="notes" className={`${headingFont} mb-5 text-[28px] leading-tight text-neutral-900 md:text-[38px]`}>What to tell us when you enquire</h2>
            <p className="mb-6 text-lg leading-8 text-neutral-600">The more we know up front, the faster we can come back with an accurate offer.</p>
            <CheckList items={mineral.buyerNotes} />
          </Reveal>
          <Reveal variant="right" delay={120}>
            <div className={`${card} p-7 md:p-9`}>
              <h3 className="mb-3 text-xl font-bold text-neutral-900">Documents with every shipment</h3>
              <p className="mb-5 text-neutral-600">Each consignment travels with the paperwork you need to clear customs and verify quality.</p>
              <ul className="flex flex-wrap gap-2">{["Certificate of analysis", "Packing list", "Commercial invoice", "Bill of lading", "Certificate of origin on request"].map((d) => <li key={d}><Tag tone="red">{d}</Tag></li>)}</ul>
            </div>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="related" className="bg-white">
        <div className={`${container} py-10 md:py-14`}>
          <SectionHeading id="related" title="Other minerals" />
          <ul className="grid gap-5 md:grid-cols-3">{related.map((m, i) => <MineralCard key={m.slug} mineral={m} index={i} />)}</ul>
        </div>
      </section>

      <CtaBand title={`Ready to source ${mineral.name}?`} primary={{ label: "Request a quote", href: quote }} />
    </div>
  );
}
