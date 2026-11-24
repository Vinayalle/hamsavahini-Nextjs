import { LuEarth, LuPackageCheck, LuPickaxe, LuSearch, LuShip } from "react-icons/lu";
import { OperationsExplorer, type OperationsLocation } from "@/components/web/OperationsExplorer";
import { PHOTOS } from "@/content/photos";
import { SOURCING_PLACES } from "@/content/sourcing";
import { ProcessFlow, SplitFeature } from "@/components/web/sections";
import { ButtonLink, CtaBand, PageHero, SectionHeading, bodyFont, container } from "@/components/web/ui";
import { pageMeta } from "@/content/seo";

export const metadata = pageMeta("Global operations", "From verified mines to your port: how Hamsavahin Aarth Mines sources, inspects, stores and ships minerals worldwide.", "/global-operations");

const FLOW = [
  { icon: LuSearch, title: "Agree and source", text: "We confirm the grade, size, moisture limits, quantity, packaging and delivery terms with you, then source the material from verified mines and producers." },
  { icon: LuPickaxe, title: "Inspect and test", text: "Samples are taken and tested against the agreed specification. Independent third-party inspection can be arranged at the load port on request." },
  { icon: LuPackageCheck, title: "Store and prepare", text: "We manage warehousing, handling and packaging (bulk, jumbo bags or 50 kg bags), so the consignment is ready to load on schedule." },
  { icon: LuShip, title: "Ship and clear", text: "We coordinate inland transport, port loading, shipping and customs clearance, with delivery to the agreed port under your chosen Incoterm (FOB, CFR, CIF and others)." },
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

  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Where we work" title="Sourcing across continents, delivering to your port" description="Sourcing in India and abroad, delivering to domestic and international buyers, with every step managed by one team." crumbs={[{ label: "Global operations" }]}>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/request-a-quote">Request a quote</ButtonLink>
          <ButtonLink href="/contact-us" variant="ghost" arrow={false}>Talk to our team</ButtonLink>
        </div>
      </PageHero>

      {/* The globe: sourcing regions and supply markets */}
      <section aria-labelledby="globe-title" className="relative isolate overflow-hidden bg-neutral-950 text-white">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(59,130,246,0.2),transparent_70%),radial-gradient(40%_40%_at_90%_80%,rgba(176,128,64,0.18),transparent_70%)]" />
        <div aria-hidden className="about-grid absolute inset-0 -z-10 opacity-[0.06]" />
        <div className={`${container} pb-2 pt-12 md:pt-16`}>
          <SectionHeading id="globe-title" eyebrow="Worldwide" title="Our operations around the world" description="Where we source our commodities and the markets we supply. Click a pin on the globe, or a place in the list, to see the details. Other international markets are served worldwide." light center />
        </div>

        <div className={`${container} pb-12 pt-2 md:pb-16`}>
          <OperationsExplorer locations={locations} legend={LEGEND} />
        </div>
      </section>

      <section aria-labelledby="flow-title" className="bg-neutral-50">
        <div className={`${container} py-10 md:py-14`}>
          <SectionHeading id="flow-title" eyebrow="End to end" title="From first enquiry to your port" description="Every order follows the same clear process, from the first enquiry to delivery at your port." center />
          <div className="mt-12 md:mt-14"><ProcessFlow steps={FLOW} numbered={false} /></div>
        </div>
      </section>
      <section aria-label="Overview" className="bg-white">
        <div className={`${container} py-10 md:py-14`}>
          <SplitFeature eyebrow="Reach" title="Resource-rich regions, connected to the industries that need them" icon={LuEarth} photo={PHOTOS.global} action={<ButtonLink href="/contact-us">Talk to our team</ButtonLink>}>
            <p>We bridge producers and buyers across regions. Local knowledge at the source and in the destination market means fewer delays, clearer documents and a supplier who answers the phone in your time zone.</p>
          </SplitFeature>
        </div>
      </section>

      <CtaBand />
    </div>
  );
}
