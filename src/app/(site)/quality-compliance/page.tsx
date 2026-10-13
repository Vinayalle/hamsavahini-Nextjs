import { LuBadgeCheck, LuFileText, LuSearch, LuShieldCheck } from "react-icons/lu";
import { Reveal } from "@/components/web/motion";
import { SplitFeature, Steps } from "@/components/web/sections";
import { ButtonLink, CtaBand, PageHero, PointCard, SectionHeading, bodyFont, container } from "@/components/web/ui";
import { PILLARS, QUALITY_STEPS } from "@/content/site";
import { pageMeta } from "@/content/seo";

export const metadata = pageMeta("Quality & Compliance", "How we agree specifications, verify sources, test material and document every consignment from the mine to the port.", "/quality-compliance");

const DOCUMENTS = [
  { title: "Certificate of analysis", text: "The test results for the lot against the agreed specification.", icon: LuFileText },
  { title: "Inspection report", text: "An independent inspection at loading, arranged whenever you ask for one.", icon: LuSearch },
  { title: "Shipping documents", text: "Commercial invoice, packing list and bill of lading for customs and payment.", icon: LuFileText },
  { title: "Origin and compliance papers", text: "Certificates of origin and other compliance documents your destination requires.", icon: LuShieldCheck },
];

export default function QualityPage() {
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Responsibility" title="Quality & compliance" description="Each shipment is tested and certified to international standards, with full traceability and transparent documentation." crumbs={[{ label: "Quality & compliance" }]} />

      <section aria-label="Our approach" className="bg-white">
        <div className={`${container} py-16 md:py-24`}>
          <SplitFeature eyebrow="Our approach" title="Quality is agreed before it is shipped" icon={LuBadgeCheck} action={<ButtonLink href="/request-a-quote">Share your specification</ButtonLink>}>
            <p>Quality is not something we check at the end. We write the specification down with you first, source against it, test against it and document the result, so there are no surprises when the material arrives.</p>
            <p>Where your destination or customer requires an independent inspection, we arrange it.</p>
          </SplitFeature>
        </div>
      </section>

      <section aria-labelledby="process-title" className="bg-neutral-50">
        <div className={`${container} py-16 md:py-24`}>
          <SectionHeading id="process-title" eyebrow="How it works" title="From specification to shipment" />
          <Steps steps={QUALITY_STEPS} />
        </div>
      </section>

      <section aria-labelledby="docs-title" className="bg-white">
        <div className={`${container} py-16 md:py-24`}>
          <SectionHeading id="docs-title" eyebrow="Documentation" title="Papers that travel with your consignment" description="Certificates and compliance documents are shared on request, and always before payment is due." />
          <ul className="grid gap-5 sm:grid-cols-2">
            {DOCUMENTS.map((d, i) => <PointCard key={d.title} icon={d.icon} title={d.title} text={d.text} index={i} />)}
          </ul>
        </div>
      </section>

      <section aria-labelledby="values-title" className="bg-neutral-50">
        <div className={`${container} py-16 md:py-24`}>
          <SectionHeading id="values-title" eyebrow="What we stand for" title="The principles behind every consignment" center />
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p, i) => <PointCard key={p.title} icon={p.icon} title={p.title} text={p.text} index={i} />)}
          </ul>
          <Reveal className="mt-10 text-center"><ButtonLink href="/sustainability" variant="outline">Our sustainability commitment</ButtonLink></Reveal>
        </div>
      </section>

      <CtaBand title="Need a specification checked?" text="Send us your requirement and we will tell you what we can source, how it will be tested and which documents come with it." />
    </div>
  );
}
