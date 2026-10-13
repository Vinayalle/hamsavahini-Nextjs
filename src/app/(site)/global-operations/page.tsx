import { LuEarth, LuMapPin, LuPackageCheck, LuPickaxe, LuSearch, LuShip } from "react-icons/lu";
import { Reveal } from "@/components/web/motion";
import { SplitFeature, Steps } from "@/components/web/sections";
import { ButtonLink, CtaBand, PageHero, SectionHeading, Tag, Unavailable, badge, bodyFont, card, container } from "@/components/web/ui";
import { pageMeta } from "@/content/seo";
import { listLocations, loadPublic } from "@/server/services/public";

export const metadata = pageMeta("Global operations", "From verified mines to your port: how Hamsavahin Aarth Mines sources, inspects, stores and ships minerals worldwide.", "/global-operations");

const FLOW = [
  { icon: LuPickaxe, title: "Source", text: "We work with verified mines and producers, and agree the specification before a consignment is arranged." },
  { icon: LuSearch, title: "Inspect and test", text: "Material is sampled and tested against the specification, with an independent inspection when you want one." },
  { icon: LuPackageCheck, title: "Store and prepare", text: "Warehousing, handling and packaging are managed so the consignment is ready to load on schedule." },
  { icon: LuShip, title: "Ship and clear", text: "Shipping, customs and delivery to the agreed port are coordinated end to end, with documents at every step." },
];

export default async function GlobalOperationsPage() {
  const { data: locations, failed } = await loadPublic(() => listLocations(), []);
  const types = [...new Set(locations.map((l) => l.type))];
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Where we work" title="Global operations" description="From the mine to the port of delivery, we manage the entire supply chain so material arrives smoothly and on time." crumbs={[{ label: "Global operations" }]} />

      <section aria-label="Overview" className="bg-white">
        <div className={`${container} py-16 md:py-24`}>
          <SplitFeature eyebrow="Reach" title="Resource-rich regions, connected to the industries that need them" icon={LuEarth} action={<ButtonLink href="/contact-us">Talk to our team</ButtonLink>}>
            <p>We bridge producers and buyers across regions. Local knowledge at the source and in the destination market means fewer delays, clearer documents and a supplier who answers the phone in your time zone.</p>
          </SplitFeature>
        </div>
      </section>

      <section aria-labelledby="flow-title" className="bg-neutral-50">
        <div className={`${container} py-16 md:py-24`}>
          <SectionHeading id="flow-title" eyebrow="End to end" title="How a consignment moves" />
          <Steps steps={FLOW} />
        </div>
      </section>

      <section aria-labelledby="locations-title" className="bg-white">
        <div className={`${container} py-16 md:py-24`}>
          <SectionHeading id="locations-title" eyebrow="Locations" title="Where we operate" description="Offices, sourcing locations, facilities and ports we work with." />
          {failed ? <Unavailable /> : locations.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center text-neutral-600">Our locations will be listed here soon. To discuss a specific region, <a href="/contact-us" className="font-bold text-[var(--brand-red)] underline">contact us</a>.</p>
          ) : (
            <div className="space-y-12">
              {types.map((t) => (
                <div key={t}>
                  <h3 className="mb-4 text-lg font-bold text-neutral-900">{t}s</h3>
                  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {locations.filter((l) => l.type === t).map((l, i) => (
                      <Reveal key={l.id} as="li" delay={(i % 3) * 90}>
                        <div className={`${card} flex h-full items-start gap-4 p-5`}>
                          <span aria-hidden className={`${badge} size-11 shrink-0 !rounded-xl`}><LuMapPin className="size-5" /></span>
                          <div className="min-w-0">
                            <p className="font-bold text-neutral-900">{l.name}</p>
                            <p className="text-sm text-neutral-600">{[l.city, l.country].filter(Boolean).join(", ")}</p>
                            {l.description && <p className="mt-2 text-sm leading-6 text-neutral-600">{l.description}</p>}
                            {(l.operations || l.capacity) && <div className="mt-3 flex flex-wrap gap-2">{l.operations && <Tag>{l.operations}</Tag>}{l.capacity && <Tag tone="red">{l.capacity}</Tag>}</div>}
                          </div>
                        </div>
                      </Reveal>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <CtaBand />
    </div>
  );
}
