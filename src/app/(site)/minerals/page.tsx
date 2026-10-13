import { LuLayers } from "react-icons/lu";
import { MineralCard, SeeAll } from "@/components/web/sections";
import { CtaBand, PageHero, SectionHeading, bodyFont, container } from "@/components/web/ui";
import { MINERALS } from "@/content/site";
import { pageMeta } from "@/content/seo";

export const metadata = pageMeta("Minerals", "Iron ore, quartz and silica, bauxite, manganese, granite and specialty minerals sourced from verified producers and delivered to your port.", "/minerals");

export default function MineralsPage() {
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="What we supply" title="Minerals we source and supply" description="Every mineral is sourced from verified producers, tested against your specification and delivered with full documentation." crumbs={[{ label: "Minerals" }]} />
      <section aria-labelledby="all-minerals" className="bg-white">
        <div className={`${container} py-10 md:py-14`}>
          <SectionHeading id="all-minerals" title="Choose a mineral to see how we supply it" description="Not sure which grade you need? Tell us your end use and we will match it to the right source." />
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MINERALS.map((m, i) => <MineralCard key={m.slug} mineral={m} index={i} />)}
          </ul>
          <SeeAll href="/products"><LuLayers className="size-4" aria-hidden /> Browse the product catalogue</SeeAll>
        </div>
      </section>
      <CtaBand />
    </div>
  );
}
