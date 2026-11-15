import { LuHandshake, LuPickaxe, LuShip } from "react-icons/lu";
import { Reveal } from "@/components/web/motion";
import { ButtonLink, CtaBand, PageHero, SectionHeading, badge, bodyFont, card, cardHover, container, headingFont } from "@/components/web/ui";
import { WHY_US } from "@/content/site";
import { pageMeta } from "@/content/seo";

export const metadata = pageMeta("Partner with us", "Why producers and buyers partner with Hamsavahin Aarth Mines: global reach with local expertise, reliable supply, transparent operations and quality at every stage.", "/partner-with-us");

const WAYS = [
  { icon: LuShip, title: "Buy from us", text: "Tell us the mineral, grade, quantity and destination. We come back with sourcing options and delivery terms.", href: "/request-a-quote", cta: "Request a quote" },
  { icon: LuPickaxe, title: "Supply to us", text: "Producers and mines with verified material can introduce themselves, and we will discuss specification and supply.", href: "/contact-us?subject=Supplier%20introduction", cta: "Introduce your mine" },
  { icon: LuHandshake, title: "Work with us long term", text: "Supply arrangements and long-term contracts that keep production running, with one team that knows your requirement.", href: "/contact-us?subject=Long-term%20partnership", cta: "Start a conversation" },
];

export default function PartnerPage() {
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Work with us" title="Partner with us" description="Producers and buyers choose us for reliable supply, clear documents and a team that answers in their own time zone." crumbs={[{ label: "Partner with us" }]}>
        <ButtonLink href="/contact-us?subject=Partnership%20enquiry">Start a conversation</ButtonLink>
      </PageHero>

      <section aria-labelledby="why-title" className="bg-white">
        <div className={`${container} grid items-stretch gap-10 py-12 md:py-16 lg:grid-cols-[1fr_0.9fr] lg:gap-14`}>
          <Reveal variant="left">
            <div className="relative h-full overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-950 to-ink p-7 text-white shadow-2xl shadow-neutral-900/30 ring-1 ring-white/10 md:p-10">
              <div aria-hidden className="about-float absolute -right-12 -top-12 size-56 rounded-full bg-gold-500/35 blur-3xl" />
              <h2 id="why-title" className={`${headingFont} relative mb-8 text-[28px] md:text-[36px]`}>Why Partner With Us</h2>
              <ul className="relative space-y-6">
                {WHY_US.map((w, i) => (
                  <Reveal key={w.title} as="li" variant="left" delay={150 + i * 100} className="flex items-start gap-4">
                    <span aria-hidden className={`${badge} size-12 !rounded-xl`}><w.icon className="size-6" strokeWidth={2.2} /></span>
                    <span>
                      <span className="block text-lg font-bold leading-snug">{w.title}</span>
                      <span className="mt-1 block text-[15px] leading-6 text-white/70">{w.text}</span>
                    </span>
                  </Reveal>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal variant="right" delay={160}>
            <figure className="group relative h-full min-h-[340px] overflow-hidden rounded-3xl shadow-2xl shadow-neutral-900/20 ring-1 ring-black/10">
              <img src="/images/about-mine.jpg" alt="A mining truck on a haul road in an open-pit mine" width={1100} height={620} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover transition-transform duration-1000 group-hover:scale-105" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <figcaption className="absolute inset-x-0 bottom-0 p-6 text-lg font-bold text-white md:p-8">From verified mines to your port</figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="ways-title" className="bg-neutral-50">
        <div className={`${container} py-10 md:py-14`}>
          <SectionHeading id="ways-title" eyebrow="How to begin" title="Three ways to work with us" center />
          <ul className="grid gap-5 md:grid-cols-3">
            {WAYS.map((w, i) => (
              <Reveal key={w.title} as="li" variant="scale" delay={i * 110}>
                <div className={`${card} ${cardHover} flex h-full flex-col p-7`}>
                  <div aria-hidden className={`${badge} mb-5 size-14`}><w.icon className="size-7" strokeWidth={2} /></div>
                  <h3 className="mb-2 text-xl font-bold text-neutral-900">{w.title}</h3>
                  <p className="flex-1 text-base leading-7 text-neutral-600">{w.text}</p>
                  <div className="mt-6"><ButtonLink href={w.href} variant="outline">{w.cta}</ButtonLink></div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand />
    </div>
  );
}
