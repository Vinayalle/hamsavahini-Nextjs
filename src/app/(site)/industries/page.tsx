import Link from "next/link";
import { LuArrowRight } from "react-icons/lu";
import { Reveal } from "@/components/web/motion";
import { CheckList } from "@/components/web/sections";
import { ButtonLink, CtaBand, PageHero, SectionHeading, badge, bodyFont, card, container, headingFont } from "@/components/web/ui";
import { INDUSTRIES, mineralBySlug } from "@/content/site";
import { pageMeta } from "@/content/seo";

export const metadata = pageMeta("Industries", "Steel and metallurgy, glass and ceramics, construction, power and energy, and industrial manufacturing: the industries we supply with minerals.", "/industries");

export default function IndustriesPage() {
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Who we serve" title="Industries we serve" description="Different industries need different minerals, specifications and delivery rhythms. We supply each of them with the same discipline." crumbs={[{ label: "Industries" }]} />

      <section aria-label="Industries overview" className="bg-white">
        <div className={`${container} py-14 md:py-20`}>
          <SectionHeading title="Five industries, one reliable supplier" center />
          <ul className="flex flex-wrap justify-center gap-3">
            {INDUSTRIES.map((i) => (
              <li key={i.slug}><a href={`#${i.slug}`} className="group inline-flex items-center gap-2.5 rounded-full border border-neutral-200 bg-white px-5 py-3 text-base font-bold text-neutral-800 transition hover:border-red-200 hover:text-[var(--brand-red)] hover:shadow-lg"><i.icon className="size-5 text-[var(--brand-red)]" aria-hidden />{i.name}</a></li>
            ))}
          </ul>
        </div>
      </section>

      {INDUSTRIES.map((ind, idx) => (
        <section key={ind.slug} id={ind.slug} aria-labelledby={`${ind.slug}-title`} className={`scroll-mt-[calc(var(--site-header-h)+8px)] ${idx % 2 === 0 ? "bg-neutral-50" : "bg-white"}`}>
          <div className={`${container} grid items-start gap-10 py-14 md:grid-cols-[0.9fr_1.1fr] md:gap-16 md:py-20`}>
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
                      <li key={s}><Link href={`/minerals/${s}`} className="group inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-[var(--brand-red)] hover:text-white"><m.icon className="size-4" aria-hidden />{m.name}<LuArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden /></Link></li>
                    );
                  })}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>
      ))}

      <CtaBand />
    </div>
  );
}
