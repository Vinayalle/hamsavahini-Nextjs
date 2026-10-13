import { LuLeaf } from "react-icons/lu";
import { SplitFeature } from "@/components/web/sections";
import { ButtonLink, CtaBand, PageHero, PointCard, SectionHeading, bodyFont, container } from "@/components/web/ui";
import { PILLARS, SUSTAINABILITY_PRACTICES } from "@/content/site";
import { pageMeta } from "@/content/seo";

export const metadata = pageMeta("Sustainability", "Responsible mining practices, fair trade and environmental stewardship in every partnership.", "/sustainability");

export default function SustainabilityPage() {
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Responsibility" title="Sustainability commitment" description="Sustainability is integral to our operations, and every partnership should contribute to a stronger global supply chain." crumbs={[{ label: "Sustainability" }]} />

      <section aria-label="Our commitment" className="bg-white">
        <div className={`${container} py-16 md:py-24`}>
          <SplitFeature eyebrow="Our commitment" title="A stronger, more sustainable supply chain" icon={LuLeaf} action={<ButtonLink href="/quality-compliance">See how we document quality</ButtonLink>}>
            <p>At Hamsavahin Aarth Mines, sustainability is integral to our operations. We promote responsible mining practices, fair trade, and environmental stewardship, ensuring that every partnership contributes to a stronger, more sustainable global supply chain.</p>
            <p>Our vision is to be a globally trusted and sustainable leader in mineral sourcing and trading, building bridges between resource-rich regions and the industries shaping the world&rsquo;s future.</p>
          </SplitFeature>
        </div>
      </section>

      <section aria-labelledby="practices-title" className="bg-neutral-50">
        <div className={`${container} py-16 md:py-24`}>
          <SectionHeading id="practices-title" eyebrow="In practice" title="How we put it to work" />
          <ul className="grid gap-5 sm:grid-cols-2">
            {SUSTAINABILITY_PRACTICES.map((p, i) => <PointCard key={p.title} icon={p.icon} title={p.title} text={p.text} index={i} />)}
          </ul>
        </div>
      </section>

      <section aria-labelledby="pillars-title" className="bg-white">
        <div className={`${container} py-16 md:py-24`}>
          <SectionHeading id="pillars-title" eyebrow="Principles" title="What guides our decisions" center />
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p, i) => <PointCard key={p.title} icon={p.icon} title={p.title} text={p.text} index={i} />)}
          </ul>
        </div>
      </section>

      <CtaBand title="Build a responsible supply chain with us" />
    </div>
  );
}
