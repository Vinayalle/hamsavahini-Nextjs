import { LuEarth, LuPackageCheck, LuPickaxe, LuSearch, LuShip } from "react-icons/lu";
import { CountUp } from "@/components/web/motion";
import { OperationsExplorer, type OperationsLocation } from "@/components/web/OperationsExplorer";
import { PHOTOS } from "@/content/photos";
import { SOURCING_PLACES } from "@/content/sourcing";
import { SplitFeature, Steps } from "@/components/web/sections";
import { ButtonLink, CtaBand, PageHero, SectionHeading, bodyFont, container } from "@/components/web/ui";
import { pageMeta } from "@/content/seo";

export const metadata = pageMeta("Global operations", "From verified mines to your port: how Hamsavahin Aarth Mines sources, inspects, stores and ships minerals worldwide.", "/global-operations");

const FLOW = [
  { icon: LuPickaxe, title: "Source", text: "We work with verified mines and producers, and agree the specification before a consignment is arranged." },
  { icon: LuSearch, title: "Inspect and test", text: "Material is sampled and tested against the specification, with an independent inspection when you want one." },
  { icon: LuPackageCheck, title: "Store and prepare", text: "Warehousing, handling and packaging are managed so the consignment is ready to load on schedule." },
  { icon: LuShip, title: "Ship and clear", text: "Shipping, customs and delivery to the agreed port are coordinated end to end, with documents at every step." },
];

/** The country the company is based in; places elsewhere are "international". */
const HOME_COUNTRY = "india";
const COLOURS = { india: "#22c55e", international: "#ef4444", market: "#3b82f6", other: "#d8b574" };
const LEGEND = [
  { label: "Sourcing in India", color: COLOURS.india },
  { label: "Sourcing abroad", color: COLOURS.international },
  { label: "Supply markets", color: COLOURS.market },
];
const isAbroad = (country: string) => country.trim().toLowerCase() !== HOME_COUNTRY;

export default function GlobalOperationsPage() {
  // Only the places in src/content/sourcing.ts are shown (the company's own sourcing list). Admin > Locations does not feed this page.
  const locations: OperationsLocation[] = [
    ...SOURCING_PLACES.map((p): OperationsLocation => {
      const abroad = isAbroad(p.country);
      const market = p.kind === "market";
      return {
        id: `sourcing-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: p.name, type: market ? "Supply market" : "Sourcing region", typeKey: market ? "market" : "sourcing_location",
        country: p.country, city: p.name, latitude: p.lat, longitude: p.lng, abroad, commodities: p.commodities,
        color: market ? COLOURS.market : abroad ? COLOURS.international : COLOURS.india, operations: null, capacity: null,
        description: market ? `${p.name} is one of the markets we supply.` : `We source ${p.commodities.join(", ")} from ${p.name.replace(" (coal)", "")}${abroad ? "" : ", India"}.`,
      };
    }),
  ];
  const sourcing = locations.filter((l) => l.typeKey !== "market");
  const stats = [
    { value: new Set(SOURCING_PLACES.flatMap((p) => p.commodities)).size, label: "Commodities", color: COLOURS.other },
    { value: sourcing.length, label: "Sourcing regions", color: COLOURS.india },
    { value: new Set(sourcing.map((l) => l.country)).size, label: "Sourcing countries", color: COLOURS.international },
    { value: locations.filter((l) => l.typeKey === "market").length, label: "Supply markets", color: COLOURS.market },
  ];

  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Where we work" title="Global operations" description="From the mine to the port of delivery, we manage the entire supply chain so material arrives smoothly and on time." crumbs={[{ label: "Global operations" }]} />

      {/* The globe: sourcing regions and supply markets */}
      <section aria-labelledby="globe-title" className="relative isolate overflow-hidden bg-neutral-950 text-white">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(59,130,246,0.2),transparent_70%),radial-gradient(40%_40%_at_90%_80%,rgba(176,128,64,0.18),transparent_70%)]" />
        <div aria-hidden className="about-grid absolute inset-0 -z-10 opacity-[0.06]" />
        <div className={`${container} pb-10 pt-12 md:pb-14 md:pt-16`}>
          <SectionHeading id="globe-title" eyebrow="Worldwide" title="Our operations around the world" description="Where we source our commodities and the markets we supply. Click a pin on the globe, or a place in the list, to see the details. Other international markets are served worldwide." light center />
        </div>

        {(
          <dl className="border-y border-white/10 bg-black/30">
            <div className={`${container} grid grid-cols-2 gap-y-8 py-8 lg:grid-cols-4`}>
              {stats.map((x) => (
                <div key={x.label} className="text-center">
                  <dd className="order-1 text-4xl font-bold leading-none md:text-5xl" style={{ color: x.color }}><CountUp to={x.value} /></dd>
                  <dt className="mt-3 text-sm text-white/65">{x.label}</dt>
                </div>
              ))}
            </div>
          </dl>
        )}
        <div className={`${container} py-10 md:py-14`}>
          <OperationsExplorer locations={locations} legend={LEGEND} />
        </div>
      </section>

      <section aria-label="Overview" className="bg-white">
        <div className={`${container} py-10 md:py-14`}>
          <SplitFeature eyebrow="Reach" title="Resource-rich regions, connected to the industries that need them" icon={LuEarth} photo={PHOTOS.global} action={<ButtonLink href="/contact-us">Talk to our team</ButtonLink>}>
            <p>We bridge producers and buyers across regions. Local knowledge at the source and in the destination market means fewer delays, clearer documents and a supplier who answers the phone in your time zone.</p>
          </SplitFeature>
        </div>
      </section>

      <section aria-labelledby="flow-title" className="bg-neutral-50">
        <div className={`${container} py-10 md:py-14`}>
          <SectionHeading id="flow-title" eyebrow="End to end" title="How a consignment moves" />
          <Steps steps={FLOW} />
        </div>
      </section>
      <CtaBand />
    </div>
  );
}
