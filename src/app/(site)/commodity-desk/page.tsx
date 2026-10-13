import { LuArrowDownToLine, LuArrowUpFromLine, LuCalendar, LuMapPin } from "react-icons/lu";
import { Reveal } from "@/components/web/motion";
import { ButtonLink, CtaBand, EmptyNote, PageHero, SectionHeading, Tag, Unavailable, bodyFont, card, cardHover, container, formatDate } from "@/components/web/ui";
import { pageMeta } from "@/content/seo";
import { listOpportunities, listPrices, loadPublic } from "@/server/services/public";

export const metadata = pageMeta("Live commodity desk", "Indicative commodity prices and current trade opportunities from Hamsavahin Aarth Mines.", "/commodity-desk");

const money = (n: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);

export default async function CommodityDeskPage() {
  const [prices, opps] = await Promise.all([loadPublic(() => listPrices(), []), loadPublic(() => listOpportunities(), [])]);
  const groups = [...new Set(prices.data.map((p) => p.group))];
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Markets" title="Live commodity desk" description="Indicative prices and the trade opportunities we are working on right now." crumbs={[{ label: "Insights", href: "/insights" }, { label: "Commodity desk" }]} />

      <section aria-labelledby="prices-title" className="bg-white">
        <div className={`${container} py-14 md:py-20`}>
          <SectionHeading id="prices-title" eyebrow="Prices" title="Latest indicative prices" description="Prices are indicative and change with the market. Request a quote for a firm offer." />
          {prices.failed ? <Unavailable /> : prices.data.length === 0 ? (
            <EmptyNote title="No prices published yet" text="Our latest prices will appear here when they are released." action={<ButtonLink href="/request-a-quote">Request a quote</ButtonLink>} />
          ) : (
            <div className="space-y-10">
              {groups.map((g) => (
                <Reveal key={g}>
                  <h3 className="mb-3 text-lg font-bold text-neutral-900">{g}</h3>
                  <div className="overflow-x-auto rounded-2xl border border-neutral-200">
                    <table className="w-full min-w-[640px] text-left">
                      <caption className="sr-only">{g} prices</caption>
                      <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500"><tr><th scope="col" className="px-5 py-3">Commodity</th><th scope="col" className="px-5 py-3">Market</th><th scope="col" className="px-5 py-3 text-right">Price</th><th scope="col" className="px-5 py-3">Unit</th><th scope="col" className="px-5 py-3">As of</th></tr></thead>
                      <tbody className="divide-y divide-neutral-200 text-neutral-700">
                        {prices.data.filter((p) => p.group === g).map((p) => (
                          <tr key={p.slug}><th scope="row" className="px-5 py-4 font-bold text-neutral-900">{p.name} <span className="ml-1 text-xs font-normal text-neutral-500">{p.code}</span></th><td className="px-5 py-4">{p.market}</td><td className="px-5 py-4 text-right font-bold text-neutral-900">{money(p.price, p.currency)}</td><td className="px-5 py-4">per {p.unit}</td><td className="px-5 py-4">{formatDate(p.date)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="opps-title" className="bg-neutral-50">
        <div className={`${container} py-14 md:py-20`}>
          <SectionHeading id="opps-title" eyebrow="Trade" title="Current opportunities" description="What we can supply and what we are looking to buy. Interested? Get in touch before the offer expires." />
          {opps.failed ? <Unavailable /> : opps.data.length === 0 ? (
            <EmptyNote title="No open opportunities at the moment" text="New offers and requirements are published here as they arise. You can always tell us what you need." action={<ButtonLink href="/request-a-quote">Request a quote</ButtonLink>} />
          ) : (
            <ul className="grid gap-5 md:grid-cols-2">
              {opps.data.map((o, i) => (
                <Reveal key={o.id} as="li" delay={(i % 2) * 90}>
                  <div className={`${card} ${cardHover} flex h-full flex-col p-6 md:p-7`}>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <Tag tone={o.type === "sell" ? "green" : "red"}>{o.type === "sell" ? <><LuArrowUpFromLine className="mr-1 size-3.5" aria-hidden />For sale</> : <><LuArrowDownToLine className="mr-1 size-3.5" aria-hidden />Wanted</>}</Tag>
                      <Tag>{o.commodity}</Tag><Tag tone="amber">{o.status}</Tag>
                    </div>
                    <h3 className="mb-2 text-xl font-bold text-neutral-900">{o.title}</h3>
                    <p className="flex-1 leading-7 text-neutral-600">{o.description}</p>
                    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div><dt className="text-xs font-bold uppercase tracking-wider text-neutral-500">Quantity</dt><dd className="font-bold text-neutral-900">{o.quantity}</dd></div>
                      <div><dt className="text-xs font-bold uppercase tracking-wider text-neutral-500">Incoterm</dt><dd className="font-bold text-neutral-900">{o.incoterm}</dd></div>
                      <div><dt className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-neutral-500"><LuMapPin className="size-3.5" aria-hidden />Route</dt><dd className="font-bold text-neutral-900">{o.origin} → {o.destination}</dd></div>
                      <div><dt className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-neutral-500"><LuCalendar className="size-3.5" aria-hidden />Valid until</dt><dd className="font-bold text-neutral-900">{formatDate(o.validUntil)}</dd></div>
                    </dl>
                    <div className="mt-6"><ButtonLink href={`/request-a-quote?mineral=${encodeURIComponent(o.commodity)}`} variant="outline">Enquire about this</ButtonLink></div>
                  </div>
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </section>
      <CtaBand />
    </div>
  );
}
