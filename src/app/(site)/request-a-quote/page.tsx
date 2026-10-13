import { LuClipboardList, LuFileCheck2, LuSend } from "react-icons/lu";
import { RfqForm } from "@/components/web/forms";
import { Reveal } from "@/components/web/motion";
import { PageHero, badge, bodyFont, card, container, headingFont } from "@/components/web/ui";
import { pageMeta, prefill } from "@/content/seo";

export const metadata = pageMeta("Request a quote", "Tell us the mineral, quantity and destination and our team will come back with a quotation.", "/request-a-quote");

const STEPS = [
  { icon: LuClipboardList, title: "Tell us what you need", text: "Mineral, quantity, incoterm and delivery port. Add any specification details you have." },
  { icon: LuFileCheck2, title: "We review and source", text: "Our team checks the requirement against our producers and confirms what can be supplied." },
  { icon: LuSend, title: "You receive a quotation", text: "We reply by email with price, specification, documents and the delivery schedule." },
];

export default async function QuotePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Trade" title="Request a quote" description="Tell us the mineral, quantity and destination. We will come back with sourcing options and a quotation." crumbs={[{ label: "Request a quote" }]} />
      <section aria-label="Request a quotation" className="bg-neutral-50">
        <div className={`${container} grid items-start gap-10 py-14 md:py-20 lg:grid-cols-[0.7fr_1.3fr] lg:gap-14`}>
          <Reveal variant="left">
            <h2 className={`${headingFont} mb-6 text-2xl text-neutral-900 md:text-3xl`}>How it works</h2>
            <ol className="space-y-5">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span aria-hidden className={`${badge} size-12 shrink-0`}><s.icon className="size-6" /></span>
                  <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-red)]">Step {i + 1}</p><h3 className="font-bold text-neutral-900">{s.title}</h3><p className="mt-1 leading-7 text-neutral-600">{s.text}</p></div>
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal variant="right" delay={120}>
            <div className={`${card} p-7 shadow-xl shadow-neutral-900/5 md:p-10`}>
              <RfqForm defaultRequirement={prefill(sp.mineral, 300)} />
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
